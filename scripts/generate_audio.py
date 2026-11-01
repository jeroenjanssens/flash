# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = ["kokoro>=0.9.4", "soundfile", "pip"]
# ///
"""Generate pronunciation audio for a deck with Kokoro (https://huggingface.co/hexgrad/Kokoro-82M).

For every text field marked `"speak": true` and every voice in the deck's `voices` (with
`"engine": "kokoro"`), this writes `media/audio/<voice>/<card id>-<field>.mp3` and adds the paths
to the text values in deck.json. Clips are trimmed, loudness-normalised and encoded as MP3
(mono, 64 kbps). A clip is only made again when its text or voice changed (see
media/audio/sources.json), unless --force is given.

Needs espeak-ng (`brew install espeak-ng`) and ffmpeg. The model (~330 MB) is downloaded on the
first run.

Usage:
  uv run scripts/generate_audio.py <deck dir>                 # all voices
  uv run scripts/generate_audio.py <deck dir> --voice male    # one voice
  uv run scripts/generate_audio.py <deck dir> --force         # regenerate everything
  uv run scripts/generate_audio.py <deck dir> --preview DIR   # compare candidate voices
"""

import argparse
import html
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

SAMPLE_RATE = 24000
# Candidate voices for the preview page: Kokoro's best British and American voices.
CANDIDATES = [
    "bf_emma", "bf_isabella", "bf_alice", "bf_lily",
    "bm_george", "bm_lewis", "bm_daniel", "bm_fable",
    "af_heart", "af_bella", "am_michael", "am_fenrir",
]

_pipelines: dict[str, object] = {}


def pipeline(voice: str, lang: str):
    """Kokoro's pipeline: 'b' British English, 'a' American English. The voice decides (its name
    starts with the code: bf_lily, af_heart), so an American voice also pronounces like one."""
    from kokoro import KPipeline

    code = voice[0] if voice[:1] in ("a", "b") else ("b" if lang.lower() in ("en-gb", "en") else "a")
    if code not in _pipelines:
        _pipelines[code] = KPipeline(lang_code=code, repo_id="hexgrad/Kokoro-82M")
    return _pipelines[code]


# How clips are made (--method); part of sources.json, so changing it makes every clip again.
#   plain:   the word on its own, with a full stop (chosen by ear, with af_heart and am_michael)
#   carrier: the word cut out of "I said … twice" (avoids an "-eh" after a final consonant,
#            which some voices add; it sounded best with bf_lily)
METHODS = ("plain", "carrier")
METHOD = "plain"
CARRIER = ("I said", "twice.")


def say(text: str, voice: str, lang: str):
    results = list(pipeline(voice, lang)(text, voice=voice))
    audio = np.concatenate([np.asarray(r.audio) for r in results])
    tokens = [t for r in results for t in (r.tokens or [])]
    return audio, tokens


def fade(x: np.ndarray, ms_in: float = 2, ms_out: float = 20) -> np.ndarray:
    x = x.copy()
    n_in, n_out = int(SAMPLE_RATE * ms_in / 1000), int(SAMPLE_RATE * ms_out / 1000)
    x[:n_in] *= np.linspace(0, 1, n_in)
    x[-n_out:] *= np.linspace(1, 0, n_out)
    return x


def synthesize(text: str, voice: str, lang: str) -> np.ndarray:
    if METHOD == "plain":
        return say(text + "." if text[-1:].isalnum() else text, voice, lang)[0]
    return synthesize_carrier(text, voice, lang)


def synthesize_carrier(text: str, voice: str, lang: str) -> np.ndarray:
    """The text, said inside a short sentence and cut out of it.

    Said on its own, Kokoro adds a short "-eh" after a final consonant ("fridge-eh"). Inside
    "I said fridge twice" the word runs straight into the next one, so cutting it out (by the
    word timestamps Kokoro gives) leaves a clean word. This sounded best of four ways tried.
    Falls back to the word on its own (with a full stop, which is clearer) if the timestamps
    are missing.
    """
    audio, tokens = say(f"{CARRIER[0]} {text} {CARRIER[1]}", voice, lang)
    lead = len(CARRIER[0].split())
    inner = tokens[lead:-2] if len(tokens) > lead + 2 else []
    if inner and inner[0].start_ts is not None and inner[-1].end_ts is not None:
        start, end = int(inner[0].start_ts * SAMPLE_RATE), int(inner[-1].end_ts * SAMPLE_RATE)
        if end - start > SAMPLE_RATE // 10:
            return fade(audio[start:end])
    plain, _ = say(text + "." if text[-1:].isalnum() else text, voice, lang)
    return plain


def encode(samples: np.ndarray, out: Path) -> None:
    """Trim the silence, normalise the loudness and write a mono 64 kbps MP3."""
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".wav") as wav:
        sf.write(wav.name, samples, SAMPLE_RATE)
        trim = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05"
        chain = f"{trim},areverse,{trim},areverse,loudnorm=I=-16:TP=-1.5:LRA=11,adelay=40"
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", wav.name, "-af", chain,
             "-ac", "1", "-ar", "24000", "-b:a", "64k", str(out)],
            check=True,
        )


def generate(deck_dir: Path, only_voice: str | None, force: bool) -> None:
    deck_path = deck_dir / "deck.json"
    deck = json.loads(deck_path.read_text())
    voices = [v for v in deck.get("voices", []) if v.get("engine") == "kokoro"]
    if only_voice:
        voices = [v for v in voices if v["id"] == only_voice]
    if not voices:
        sys.exit("no Kokoro voices to generate (see the deck's `voices`)")
    fields = {f["id"]: f for f in deck["fields"] if f["type"] == "text" and f.get("speak")}
    sources_path = deck_dir / "media" / "audio" / "sources.json"
    sources = json.loads(sources_path.read_text()) if sources_path.exists() else {}
    made = 0
    for card in deck["cards"]:
        for field_id, field in fields.items():
            value = card["fields"].get(field_id)
            if not value:
                continue
            lang = value.get("lang", field["lang"])
            audio = value.setdefault("audio", {})
            for voice in voices:
                src = f"media/audio/{voice['id']}/{card['id']}-{field_id}.mp3"
                wanted = {"text": value["text"], "voice": voice["voice"], "lang": lang, "method": f"{METHOD}-1"}
                if force or sources.get(src) != wanted or not (deck_dir / src).exists():
                    encode(synthesize(value["text"], voice["voice"], lang), deck_dir / src)
                    sources[src] = wanted
                    made += 1
                    print(f"  {voice['id']:6} {value['text']}")
                audio[voice["id"]] = src
            # Keep only the voices the deck still has, in its order.
            value["audio"] = {v["id"]: audio[v["id"]] for v in deck["voices"] if v["id"] in audio}
    sources_path.parent.mkdir(parents=True, exist_ok=True)
    sources_path.write_text(json.dumps(dict(sorted(sources.items())), indent=2, ensure_ascii=False) + "\n")
    deck_path.write_text(json.dumps(deck, indent=2, ensure_ascii=False) + "\n")
    print(f"{made} clips made")


def preview(deck_dir: Path, out: Path, voices: list[str] | None = None, count: int = 8) -> None:
    """A page that plays a few of the deck's words in every candidate voice."""
    deck = json.loads((deck_dir / "deck.json").read_text())
    word_field = next(f for f in deck["fields"] if f["type"] == "text" and f.get("speak"))
    cards = deck["cards"]
    step = max(1, len(cards) // count)
    words = [c["fields"][word_field["id"]]["text"] for c in cards[::step][:count]]
    rows = []
    out.mkdir(parents=True, exist_ok=True)
    for voice in voices or CANDIDATES:
        lang = "en-GB" if voice[0] == "b" else "en-US"
        cells = []
        for i, word in enumerate(words):
            name = f"{voice}-{i}.mp3"
            encode(synthesize(word, voice, lang), out / name)
            cells.append(f'<button onclick="new Audio(\'{name}\').play()">{html.escape(word)}</button>')
        print(f"  {voice}")
        rows.append(f"<tr><th>{voice}</th><td>{lang}</td><td>{''.join(cells)}</td></tr>")
    (out / "index.html").write_text(
        "<!doctype html><meta charset=utf-8><title>Voice preview</title>"
        "<style>body{font:16px system-ui;margin:2rem}td,th{padding:.4rem;text-align:left}"
        "button{margin:.15rem;padding:.3rem .7rem;border-radius:99px;border:1px solid #ccc;"
        "background:#fff;cursor:pointer}</style><h1>Kokoro voices</h1>"
        "<p>b = British, a = American; f = female, m = male. Put the ones you like in the deck's "
        "<code>voices</code> and run <code>just audio</code>.</p><table>" + "".join(rows) + "</table>"
    )
    print(f"open {out / 'index.html'}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("deck", type=Path)
    parser.add_argument("--voice")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--preview", type=Path, metavar="DIR")
    parser.add_argument("--voices", help="comma-separated Kokoro voices for --preview, e.g. bf_lily,af_heart")
    parser.add_argument("--method", choices=METHODS, default="plain", help="how clips are made (see METHODS)")
    args = parser.parse_args()
    global METHOD
    METHOD = args.method
    if args.preview:
        preview(args.deck, args.preview, args.voices.split(",") if args.voices else None)
    else:
        generate(args.deck, args.voice, args.force)


if __name__ == "__main__":
    main()
