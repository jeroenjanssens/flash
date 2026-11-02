"""Turn extracted cards (from extract_pdf_deck.py) into a deck folder with a deck.json to curate.

The deck gets the standard fields (picture, word, translation) and the six standard templates,
a new UUID, a new random id per card, and the OCR'd words in lowercase. Everything else
(titles, translations, `accept`, tags, `confusable`) is filled in or checked afterwards, by hand
or by an agent: see docs/making-decks.md.

If the deck folder already has a deck.json, cards are matched on `ref` and keep their ids, so
progress survives re-extracting; the revision goes up by one.

Usage:
  uv run scripts/new_deck.py <extracted dir> <deck dir> --title-en "My home" --title-nl "Mijn huis"
      [--language en-GB] [--native nl] [--collection-id stepping-stones-junior-3b]
      [--collection-title "Stepping Stones Junior 3B"] [--position 1]
      [--source-title "…"] [--publisher "…"] [--copyright "…"] [--color "#e8590c"]
"""

import argparse
import json
import secrets
import shutil
import string
import uuid
from datetime import datetime, timezone
from pathlib import Path

ALPHABET = string.ascii_letters + string.digits
# Words that keep their capital in English (names are kept by hand, see the docs).
KEEP = {"I"}


def card_id() -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(10))


def lowercase(word: str) -> str:
    """Lowercase, unless the word needs its capital (I, or all-caps abbreviations like TV)."""
    out = []
    for w in word.split(" "):
        out.append(w if w in KEEP or (len(w) > 1 and w.isupper()) else w.lower())
    return " ".join(out).strip()


def templates(native_name: dict, learn_name: dict) -> list[dict]:
    L = lambda en, nl: {"en": en, "nl": nl}  # noqa: E731
    return [
        {"id": "picture-to-word", "name": L(f"Picture → {learn_name['en']}", f"Plaatje → {learn_name['nl']}"),
         "prompt": ["image"], "answer": "word", "reveal": ["translation"], "methods": ["type", "choose", "flip"]},
        {"id": "dutch-to-english", "name": L(f"{native_name['en']} → {learn_name['en']}", f"{native_name['nl']} → {learn_name['nl']}"),
         "prompt": ["translation"], "answer": "word", "reveal": ["image"], "methods": ["type", "choose", "flip"]},
        {"id": "word-to-picture", "name": L(f"{learn_name['en']} → picture", f"{learn_name['nl']} → plaatje"),
         "prompt": ["word"], "answer": "image", "reveal": ["translation"], "methods": ["choose"], "enabled": False},
        {"id": "listen-to-picture", "name": L("Listen → picture", "Luisteren → plaatje"),
         "prompt": [{"field": "word", "as": "audio"}], "answer": "image", "reveal": ["word", "translation"],
         "methods": ["choose"], "enabled": False},
        {"id": "dictation", "name": L("Listen → spell", "Luisteren → spellen"),
         "prompt": [{"field": "word", "as": "audio"}], "answer": "word", "reveal": ["image", "translation"],
         "methods": ["type"], "enabled": False},
        {"id": "english-to-dutch", "name": L(f"{learn_name['en']} → {native_name['en']}", f"{learn_name['nl']} → {native_name['nl']}"),
         "prompt": ["word"], "answer": "translation", "reveal": ["image"], "methods": ["type", "choose", "flip"],
         "enabled": False},
    ]


LANGUAGE_NAMES = {
    "en": {"en": "English", "nl": "Engels"},
    "nl": {"en": "Dutch", "nl": "Nederlands"},
    "de": {"en": "German", "nl": "Duits"},
    "fr": {"en": "French", "nl": "Frans"},
    "es": {"en": "Spanish", "nl": "Spaans"},
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("extracted", type=Path)
    parser.add_argument("deck", type=Path)
    parser.add_argument("--title-en", required=True)
    parser.add_argument("--title-nl", required=True)
    parser.add_argument("--language", default="en-GB", help="the language being learned")
    parser.add_argument("--native", default="nl", help="the language of the translations")
    parser.add_argument("--collection-id")
    parser.add_argument("--collection-title")
    parser.add_argument("--position", type=int)
    parser.add_argument("--source-title")
    parser.add_argument("--publisher")
    parser.add_argument("--copyright")
    parser.add_argument("--color", default="#ff6b4a")
    args = parser.parse_args()

    extracted = json.loads((args.extracted / "extracted.json").read_text())
    deck_path = args.deck / "deck.json"
    old = json.loads(deck_path.read_text()) if deck_path.exists() else None
    old_cards = {c.get("ref"): c for c in (old or {}).get("cards", [])}
    now = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")

    (args.deck / "media").mkdir(parents=True, exist_ok=True)
    cards = []
    for e in extracted:
        shutil.copy(args.extracted / e["image"], args.deck / e["image"])
        prev = old_cards.get(e["ref"])
        word = lowercase(e["ocr"])
        fields = {
            "image": {"src": e["image"], "type": "image/webp", "width": e["size"][0], "height": e["size"][1]},
            "word": {"text": word},
        }
        if prev:
            # Keep what was curated: the translation, alternatives, audio (regenerated if the word changed).
            for key in ("translation",):
                if key in prev["fields"]:
                    fields[key] = prev["fields"][key]
            for key in ("accept", "audio", "hint"):
                if key in prev["fields"].get("word", {}):
                    fields["word"][key] = prev["fields"]["word"][key]
        card = {"id": prev["id"] if prev else card_id(), "ref": e["ref"], "fields": fields}
        for key in ("confusable", "tags", "suspended"):
            if prev and key in prev:
                card[key] = prev[key]
        cards.append(card)

    base = args.language.split("-")[0]
    learn_name = LANGUAGE_NAMES.get(base, {"en": base, "nl": base})
    native_name = LANGUAGE_NAMES.get(args.native, {"en": args.native, "nl": args.native})
    deck = {
        "$schema": "https://raw.githubusercontent.com/jeroenjanssens/flash/main/schema/deck.schema.json",
        "format": "flash-deck",
        "formatVersion": 1,
        "id": old["id"] if old else str(uuid.uuid4()),
        "revision": old["revision"] + 1 if old else 1,
        "createdAt": old.get("createdAt", now) if old else now,
        "updatedAt": now,
        "title": {"en": args.title_en, "nl": args.title_nl},
        "cover": cards[0]["fields"]["image"]["src"] if cards else None,
        "color": args.color,
        "language": args.language,
        "tags": [learn_name["en"].lower(), "vocabulary"],
        "voices": (old or {}).get("voices") or [
            {"id": "female", "name": {"en": "Miss", "nl": "Juf"}, "gender": "female", "lang": "en-US",
             "engine": "kokoro", "voice": "af_heart",
             "credit": "Kokoro-82M by hexgrad", "license": "Apache-2.0"},
            {"id": "male", "name": {"en": "Sir", "nl": "Meester"}, "gender": "male", "lang": "en-US",
             "engine": "kokoro", "voice": "am_michael",
             "credit": "Kokoro-82M by hexgrad", "license": "Apache-2.0"},
        ],
        "fields": [
            {"id": "image", "type": "image", "name": {"en": "Picture", "nl": "Plaatje"}},
            {"id": "word", "type": "text", "lang": args.language, "speak": True, "name": {"en": "Word", "nl": "Woord"}},
            {"id": "translation", "type": "text", "lang": args.native, "optional": True, "name": native_name},
        ],
        "templates": templates(native_name, learn_name),
        "cards": cards,
    }
    if not deck["cover"]:
        del deck["cover"]
    if args.collection_id:
        deck["collection"] = {"id": args.collection_id,
                              "title": {"en": args.collection_title or args.collection_id, "nl": args.collection_title or args.collection_id}}
        if args.position:
            deck["collection"]["position"] = args.position
    source = {k: v for k, v in {"title": args.source_title, "publisher": args.publisher, "copyright": args.copyright}.items() if v}
    if source:
        deck["source"] = source
    if old:
        # Keep curated deck-level text.
        for key in ("description", "collection", "source", "cover", "color", "tags"):
            if key in old:
                deck[key] = old[key]
    deck_path.write_text(json.dumps(deck, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {deck_path} ({len(cards)} cards, revision {deck['revision']})")
    print("next: fill in translations, accept, tags and confusable; then just audio and just check-deck")


if __name__ == "__main__":
    main()
