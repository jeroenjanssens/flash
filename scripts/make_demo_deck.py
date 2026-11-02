"""Build the built-in demo deck (public/decks/colours): colours with drawn paint blobs.

All pictures are drawn here, so the deck can be public. Run `just audio public/decks/colours`
afterwards for the pronunciation.

Usage: uv run scripts/make_demo_deck.py
"""

import json
import math
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "decks" / "colours"
COLOURS = [
    ("red", "rood", "#e5383b"), ("blue", "blauw", "#2f6fdf"), ("green", "groen", "#2fa84f"),
    ("yellow", "geel", "#ffd60a"), ("orange", "oranje", "#ff8c1a"), ("purple", "paars", "#8e44ad"),
    ("pink", "roze", "#ff7eb6"), ("brown", "bruin", "#8b5a2b"), ("black", "zwart", "#1b1b1f"),
    ("white", "wit", "#ffffff"), ("grey", "grijs", "#9aa0a6"),
]


def blob(colour: str, seed: int) -> str:
    """A paint splash: a wobbly circle with a few drops, with a dark outline."""
    rnd = random.Random(seed)
    points = []
    n = 14
    for i in range(n):
        a = 2 * math.pi * i / n
        r = 70 + rnd.uniform(-12, 14)
        points.append((100 + r * math.cos(a), 100 + r * math.sin(a)))
    path = f"M{points[0][0]:.1f},{points[0][1]:.1f}"
    for i in range(n):
        p0, p1 = points[i], points[(i + 1) % n]
        mid = ((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)
        path += f" Q{p0[0]:.1f},{p0[1]:.1f} {mid[0]:.1f},{mid[1]:.1f}"
    drops = "".join(
        f'<circle cx="{100 + 92 * math.cos(a):.1f}" cy="{100 + 92 * math.sin(a):.1f}" r="{rnd.uniform(5, 10):.1f}"/>'
        for a in (rnd.uniform(0, 6.28) for _ in range(3))
    )
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">'
        f'<g fill="{colour}" stroke="#2b2140" stroke-width="3" stroke-linejoin="round">'
        f'<path d="{path} Z"/>{drops}</g>'
        '<ellipse cx="78" cy="72" rx="16" ry="9" fill="#fff" opacity=".45" transform="rotate(-30 78 72)"/>'
        "</svg>\n"
    )


def main() -> None:
    (OUT / "media").mkdir(parents=True, exist_ok=True)
    old = OUT / "deck.json"
    audio = {}
    if old.exists():  # keep generated audio paths
        for c in json.loads(old.read_text())["cards"]:
            if "audio" in c["fields"]["word"]:
                audio[c["id"]] = c["fields"]["word"]["audio"]
    cards = []
    for i, (en, nl, hex_) in enumerate(COLOURS):
        name = f"media/{en}.svg"
        (OUT / name).write_text(blob(hex_, i))
        cid = f"colour-{en}"
        word = {"text": en}
        if en == "grey":
            word["accept"] = ["gray"]
        if cid in audio:
            word["audio"] = audio[cid]
        cards.append({"id": cid, "fields": {"image": {"src": name, "type": "image/svg+xml", "width": 200, "height": 200},
                                            "word": word, "translation": {"text": nl}}, "tags": ["colours"]})
    L = lambda en, nl: {"en": en, "nl": nl}
    deck = {
        "$schema": "https://raw.githubusercontent.com/jeroenjanssens/flash/main/schema/deck.schema.json",
        "format": "flash-deck", "formatVersion": 1,
        "id": "5f0c8a1e-6f0b-4d55-9a57-2f6d3c0b9e11", "revision": 4,
        "createdAt": "2026-11-02T12:00:00+01:00", "updatedAt": "2026-11-02T12:00:00+01:00",
        "title": L("Colours", "Kleuren"),
        "description": L("Eleven colours in English. A deck to try Flash with.", "Elf kleuren in het Engels. Een stapel om Flash mee uit te proberen."),
        "cover": "media/orange.svg", "color": "#7c5cff",
        "language": "en-GB", "tags": ["english", "vocabulary", "demo"],
        "source": {"author": "Jeroen Janssens", "license": "CC0-1.0"},
        "voices": [
            {"id": "female", "name": L("Miss", "Juf"), "gender": "female", "lang": "en-US", "engine": "kokoro", "voice": "af_heart", "credit": "Kokoro-82M by hexgrad", "license": "Apache-2.0"},
            {"id": "male", "name": L("Sir", "Meester"), "gender": "male", "lang": "en-US", "engine": "kokoro", "voice": "am_michael", "credit": "Kokoro-82M by hexgrad", "license": "Apache-2.0"},
        ],
        "fields": [
            {"id": "image", "type": "image", "name": L("Picture", "Plaatje")},
            {"id": "word", "type": "text", "lang": "en-GB", "speak": True, "name": L("Word", "Woord")},
            {"id": "translation", "type": "text", "lang": "nl", "optional": True, "name": L("Dutch", "Nederlands")},
        ],
        "templates": [
            {"id": "picture-to-word", "name": L("Picture → English", "Plaatje → Engels"), "prompt": ["image"], "answer": "word", "reveal": ["translation"], "methods": ["type", "choose", "flip"]},
            {"id": "dutch-to-english", "name": L("Dutch → English", "Nederlands → Engels"), "prompt": ["translation"], "answer": "word", "reveal": ["image"], "methods": ["type", "choose", "flip"]},
            {"id": "word-to-picture", "name": L("English → picture", "Engels → plaatje"), "prompt": ["word"], "answer": "image", "reveal": ["translation"], "methods": ["choose"], "enabled": False},
            {"id": "listen-to-picture", "name": L("Listen → picture", "Luisteren → plaatje"), "prompt": [{"field": "word", "as": "audio"}], "answer": "image", "reveal": ["word", "translation"], "methods": ["choose"], "enabled": False},
            {"id": "dictation", "name": L("Listen → spell", "Luisteren → spellen"), "prompt": [{"field": "word", "as": "audio"}], "answer": "word", "reveal": ["image", "translation"], "methods": ["type"], "enabled": False},
            {"id": "english-to-dutch", "name": L("English → Dutch", "Engels → Nederlands"), "prompt": ["word"], "answer": "translation", "reveal": ["image"], "methods": ["type", "choose", "flip"], "enabled": False},
        ],
        "cards": cards,
    }
    old.write_text(json.dumps(deck, indent=2, ensure_ascii=False) + "\n")
    
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
