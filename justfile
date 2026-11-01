# flash — common development tasks. Run `just` to list them.

default:
    @just --list

# Serve the repository and open the deck preview (http://localhost:8000/preview/)
preview port="8000":
    @echo "http://localhost:{{port}}/preview/"
    uv run python -m http.server {{port}}

# Validate every deck against the JSON Schema
validate:
    uv run --with jsonschema --with rfc3339-validator python -I -c "import json, glob, jsonschema; s = json.load(open('schema/deck.schema.json')); v = jsonschema.Draft202012Validator(s, format_checker=jsonschema.FormatChecker()); [(v.validate(json.load(open(p))), print('ok', p)) for p in sorted(glob.glob('decks/*/deck.json'))]"

# Extract pictures and OCR'd words from a PDF of scanned flash cards
extract pdf out:
    uv run scripts/extract_pdf_deck.py {{pdf}} {{out}}
