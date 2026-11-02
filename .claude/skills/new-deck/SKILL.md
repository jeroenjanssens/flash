---
name: new-deck
description: Turn school flash cards (a scanned PDF, photos or a word list) into a Flash deck in the private deck library, with pictures, OCR'd and curated words, Dutch translations and pronunciation. Use when asked to make, add, extract or update a deck.
---

# Make a Flash deck

Follow `docs/making-decks.md` step by step; it is the source of truth. The format is in
`docs/deck-format.md` and `schema/deck.schema.json`.

1. **Look first.** Render a few pages (`pdftoppm -r 50 -png`) and look at them: which pages have
   pictures and which words, the grid size, the line colour, whether the word pages are mirrored,
   handwriting to ignore, the card numbers. Decide the options for `just extract`.
2. **Extract** into a scratch folder: `just extract <pdf> /tmp/<name> [options]`. Open
   `contact.png` and check **every** picture against its word. Re-run with other options if
   pairs don't match. Read the scans yourself to check the OCR.
3. **Make the deck** in `public/decks/<folder>` (or, for material that mustn't be public, in the
   private library) with `just new-deck`, with titles in English and Dutch, the collection, and
   the source and copyright. Add the folder to `public/decks/index.json`.
4. **Curate** `deck.json` as the guide says: spelling as in the source, lowercase except names
   and words that need a capital, `accept` for other spellings, a Dutch translation per card (from
   the picture's meaning), tags, `confusable`, description, cover, colour.
5. **Audio**: `just audio public/decks/<folder>`.
6. **Check**: `just check-deck public/decks/<folder>` must have 0 errors.
7. **Stop and ask for review** before committing: tell the user to run
   `just preview public/decks/<folder>` and listen, and list every judgement call you made
   (unclear OCR, translations you chose, spellings you kept or accepted).
8. After approval, run `just e2e`, then commit and push.

Never change existing deck or card ids, never delete studied cards (suspend them), bump the
revision on every change.
