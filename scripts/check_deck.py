# /// script
# requires-python = ">=3.12"
# dependencies = ["jsonschema", "rfc3339-validator"]
# ///
"""Check one or more decks: the JSON Schema, plus what a schema can't check.

- every field and template refers to fields that exist; template answers are valid
- card ids are unique; `confusable` refers to cards in the deck
- every required field is present; every media file exists and nothing in media/ is unused
- every text field marked `speak` has audio for every voice
- text is lowercase (a warning: names and "I" are allowed to have capitals)
- no duplicate answers within a template (two cards with the same word can't be told apart)

Usage: uv run scripts/check_deck.py <deck dir> [<deck dir> ...]
Exits with 1 if there are errors. Warnings don't fail the check.
"""

import json
import sys
from collections import Counter
from pathlib import Path

import jsonschema

SCHEMA = Path(__file__).resolve().parent.parent / "schema" / "deck.schema.json"


def check(deck_dir: Path) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    try:
        deck = json.loads((deck_dir / "deck.json").read_text())
    except (OSError, json.JSONDecodeError) as e:
        return [f"can't read deck.json: {e}"], []
    validator = jsonschema.Draft202012Validator(
        json.loads(SCHEMA.read_text()), format_checker=jsonschema.FormatChecker()
    )
    for e in sorted(validator.iter_errors(deck), key=lambda e: list(e.path)):
        errors.append(f"schema: {'/'.join(map(str, e.path)) or '(root)'}: {e.message}")
    if errors:
        return errors, warnings

    fields = {f["id"]: f for f in deck["fields"]}
    voices = [v["id"] for v in deck.get("voices", [])]
    ids = Counter(c["id"] for c in deck["cards"])
    errors += [f"duplicate card id {i}" for i, n in ids.items() if n > 1]
    if len({t["id"] for t in deck["templates"]}) != len(deck["templates"]):
        errors.append("duplicate template id")

    def item_field(item):
        return item if isinstance(item, str) else item["field"]

    for t in deck["templates"]:
        for item in t["prompt"] + t.get("reveal", []):
            fid = item_field(item)
            if fid not in fields:
                errors.append(f"template {t['id']}: unknown field {fid}")
            elif not isinstance(item, str) and item.get("as") == "audio" and not fields[fid].get("speak"):
                errors.append(f"template {t['id']}: {fid} is spoken but has no audio (speak: false)")
        answer = fields.get(t["answer"])
        if not answer:
            errors.append(f"template {t['id']}: unknown answer field {t['answer']}")
        elif answer["type"] == "image" and set(t.get("methods", [])) - {"choose", "flip"}:
            errors.append(f"template {t['id']}: a picture can only be chosen, not typed")
        elif answer["type"] not in ("text", "image"):
            errors.append(f"template {t['id']}: the answer must be a text or image field")

    used: set[str] = set()

    def media(path: str, where: str):
        used.add(path)
        if not (deck_dir / path).is_file():
            errors.append(f"{where}: missing file {path}")

    if deck.get("cover"):
        media(deck["cover"], "cover")
    for c in deck["cards"]:
        where = f"card {c.get('ref') or c['id']}"
        for fid, f in fields.items():
            if not f.get("optional") and fid not in c["fields"]:
                errors.append(f"{where}: no {fid}")
        for fid, v in c["fields"].items():
            f = fields.get(fid)
            if not f:
                errors.append(f"{where}: unknown field {fid}")
                continue
            if f["type"] == "text":
                if "text" not in v:
                    errors.append(f"{where}: {fid} should be text")
                    continue
                if v["text"] != v["text"].lower():
                    warnings.append(f"{where}: capitals in “{v['text']}” (fine for names and I)")
                if v["text"] != v["text"].strip() or "  " in v["text"]:
                    errors.append(f"{where}: extra spaces in “{v['text']}”")
                for src in v.get("audio", {}).values():
                    media(src, where)
                if f.get("speak"):
                    missing = [vid for vid in voices if vid not in v.get("audio", {})]
                    if missing:
                        warnings.append(f"{where}: no audio for {fid} in {', '.join(missing)}")
                unknown = set(v.get("audio", {})) - set(voices)
                if unknown:
                    errors.append(f"{where}: audio for unknown voices {', '.join(sorted(unknown))}")
            elif "src" in v:
                media(v["src"], where)
            else:
                errors.append(f"{where}: {fid} should have a src")
        for other in c.get("confusable", []):
            if other not in ids or other == c["id"]:
                errors.append(f"{where}: confusable {other} is not another card in the deck")

    for t in deck["templates"]:
        if fields.get(t["answer"], {}).get("type") != "text":
            continue
        answers = Counter(c["fields"][t["answer"]]["text"] for c in deck["cards"] if t["answer"] in c["fields"])
        for a, n in answers.items():
            if n > 1:
                warnings.append(f"template {t['id']}: {n} cards have the answer “{a}”")

    media_dir = deck_dir / "media"
    if media_dir.is_dir():
        for p in sorted(media_dir.rglob("*")):
            rel = p.relative_to(deck_dir).as_posix()
            if p.is_file() and rel not in used and p.name != "sources.json" and not p.name.startswith("."):
                warnings.append(f"unused file {rel}")
    return errors, warnings


def main() -> None:
    failed = False
    for arg in sys.argv[1:] or sys.exit(__doc__):
        errors, warnings = check(Path(arg))
        status = "✗" if errors else "✓"
        print(f"{status} {arg}: {len(errors)} errors, {len(warnings)} warnings")
        for e in errors:
            print(f"  error   {e}")
        for w in warnings:
            print(f"  warning {w}")
        failed |= bool(errors)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
