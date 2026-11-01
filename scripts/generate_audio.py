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


def pipeline(lang: str):
    """Kokoro's pipeline for a language: 'b' is British English, 'a' American English."""
    from kokoro import KPipeline

    code = "b" if lang.lower() in ("en-gb", "en") else "a"
    if code not in _pipelines:
        _pipelines[code] = KPipeline(lang_code=code, repo_id="hexgrad/Kokoro-82M")
    return _pipelines[code]


def synthesize(text: str, voice: str, lang: str) -> np.ndarray:
    chunks = [audio for _, _, audio in pipeline(lang)(text, voice=voice)]
    return np.concatenate([np.asarray(c) for c in chunks])


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
                wanted = {"text": value["text"], "voice": voice["voice"], "lang": lang}
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


def preview(deck_dir: Path, out: Path) -> None:
    """A page that plays a few of the deck's words in every candidate voice."""
    deck = json.loads((deck_dir / "deck.json").read_text())
    word_field = next(f for f in deck["fields"] if f["type"] == "text" and f.get("speak"))
    words = [c["fields"][word_field["id"]]["text"] for c in deck["cards"][:8]]
    rows = []
    for voice in CANDIDATES:
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
    args = parser.parse_args()
    if args.preview:
        preview(args.deck, args.preview)
    else:
        generate(args.deck, args.voice, args.force)


if __name__ == "__main__":
    main()
