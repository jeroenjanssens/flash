# flash

**Flashcards with spaced repetition, made for kids** — in English and Dutch (Nederlands).

Flash is at an early stage: so far there is the [deck format](docs/deck-format.md), a script
that turns scanned flash cards into a deck, and a page to check a deck.

## Decks

A deck is a folder with a `deck.json` and a `media/` folder; see
[docs/deck-format.md](docs/deck-format.md) and the [JSON Schema](schema/deck.schema.json).

### From scanned flash cards

[`scripts/extract_pdf_deck.py`](scripts/extract_pdf_deck.py) reads a PDF that alternates between
a page with ten pictures and a page with the ten matching words. It straightens the scans,
finds the grid, cuts out and trims every picture, and reads the words with OCR:

```sh
just extract cards.pdf /tmp/extracted   # needs poppler, tesseract and uv
```

The result (`extracted.json` and `media/`) is then turned into a `deck.json` by hand: words in
lowercase, metadata, and card ids.

## Development

You need [uv](https://docs.astral.sh/uv/) and [just](https://github.com/casey/just).

```sh
just preview    # check a deck at http://localhost:8000/preview/
just validate   # validate every deck against the schema
```

## License

The code is MIT licensed. Decks keep the copyright of their source, which is recorded in each
`deck.json`.
