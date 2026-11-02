# Making a new deck

This is the recipe for turning school material into a Flash deck. It's written for people and
for agents (Claude Code has a skill for it: `.claude/skills/new-deck/`). The format itself is
described in [deck-format.md](deck-format.md).

**Where decks live.** Decks are built into the app: one folder per deck in `public/decks/`,
listed in `public/decks/index.json` (in the order they're shown). For material that must not be
public, use the private deck library instead (a separate GitHub repository with the same
folders, set in *Voor ouders*).

You need [uv](https://docs.astral.sh/uv/), [just](https://github.com/casey/just), poppler
(`pdfimages`), tesseract, ffmpeg and espeak-ng: `brew install poppler tesseract ffmpeg espeak-ng`.

## 1. Look at the source first

Open the PDF (or photos) and note:

- **The layout.** Which pages have pictures and which have words? Usually pictures on the odd
  pages and words on the even pages (`--words-first` if it's the other way around).
- **The grid.** How many columns and rows of cards per page (`--cols`, `--rows`; default 2 × 5)?
  What colour are the grid lines on the picture pages (`--line-color green` or `dark`)?
- **Mirroring.** Printed double-sided, the back of a page is often mirrored: the card at the top
  left on the front has its word at the top *right* on the back. Compare the first picture with
  the first word: if they don't match, use `--mirrored`.
- **Anything to ignore.** Handwriting, names, page headers: the script only looks inside the
  grid cells, but check the contact sheet anyway.
- **What the cards are numbered** (e.g. 1.1 … 3.10): these become the cards' `ref`.

## 2. Extract

```sh
just extract cards.pdf /tmp/extracted [--rows 5 --cols 2 --mirrored --words-first --line-color green --lang eng]
```

This straightens every page (scans are often rotated by a degree or so), finds the grid, cuts
out and trims each picture (WebP), and reads each word with OCR. **Open
`/tmp/extracted/contact.png`** and check every picture against its word. If the grid wasn't
found or the pairs don't match, fix the options (usually `--mirrored` or the grid size) and run
it again. Fix OCR mistakes in the next step.

## 3. Make the deck

```sh
just new-deck /tmp/extracted public/decks/<folder> --title-en "My home" --title-nl "Mijn huis" \
  --collection-id stepping-stones-junior-3b --collection-title "Stepping Stones Junior 3B" --position 1 \
  --source-title "Stepping Stones Junior – Flash cards – Step 3B – Theme 1 My home" \
  --publisher "Noordhoff Uitgevers" --copyright "© Noordhoff Uitgevers bv"
```

The folder name is short and descriptive (`stepping-stones-3b-theme-2`). Running `new-deck`
again on an existing deck keeps the card ids (matched on `ref`) and what was curated, and bumps
the revision.

## 4. Curate `deck.json`

Go through every card:

- **Spelling.** Compare each word with the scan. Words are written as they're learned:
  **lowercase**, except where the word itself needs a capital: names (London, Tom), `I`, and in
  English days, months, languages and nationalities (Monday, English).
- **Keep the source's words.** Don't "improve" the material: if the book says `draw bridge`, the
  word is `draw bridge`. Add other correct spellings to `accept` (`["drawbridge"]`), and
  British/American variants too (`grey` → `accept: ["gray"]`).
- **Translations.** Add a Dutch `translation` to every card: the meaning *in this context* (the
  picture decides: `pass` with a car overtaking a tractor is `inhalen`). Translations are added
  by you, not from the source, so a parent should check them.
- **Tags.** One or two topical tags per card (`kitchen`, `castles`), lowercase with hyphens. A
  page of the book is often one topic.
- **Confusable.** Cards that look alike or are easily mixed up (knife / fork / spoon, king /
  queen): list each other's ids in `confusable`, so multiple choice offers them as wrong answers.
- **Deck text.** `title` and `description` in English and Dutch, a `cover` (a picture that
  says what the deck is about) and a `color`.
- **Templates.** Keep the six standard templates; `picture-to-word` and `dutch-to-english` are on
  by default. Learners can switch the others on per deck.

## 5. Pronunciation

```sh
just audio public/decks/<folder>
```

Makes an MP3 per word in each voice (`female`: Kokoro `af_heart`, `male`: `am_michael`, both
American English, chosen by ear) and adds the paths to `deck.json`. It only makes clips whose
word changed, so it's fast to run again. To compare other voices: `just voices public/decks/<folder>`
and open `voice-preview/index.html`. Some voices add a short "-eh" after a final consonant
("fridge-eh"); `just audio <deck> --method carrier` says each word inside "I said … twice" and
cuts it out, which avoids that.

## 6. Check

```sh
just check-deck public/decks/<folder>      # schema, files, audio, ids, duplicates
just preview public/decks/<folder>         # every card, both sides, both voices
```

`check-deck` must show 0 errors. Warnings about capitals are fine for names. In the preview,
**listen to every word in both voices**: text-to-speech sometimes says a single word oddly. If a
word sounds wrong, compare other voices with `just voices` and change that deck's `voices`, or
flag the word for a parent to check.

## 7. Publish

Add the folder to `public/decks/index.json`, run `just e2e`, and commit and push. CI deploys the
app, and every device picks up the new deck with the next update. (For the private library:
commit the folder there instead; devices download it when the app starts.)

## Rules that must never be broken

1. **Never change the deck `id` or a card `id`**, not even when a word is corrected. Progress
   is stored per id.
2. **Never delete a card that has been studied.** Set `"suspended": true` instead.
3. **Bump `revision`** (and `updatedAt`) on every change, or devices won't update.
4. **Check where a deck may go.** Public decks are fine for generic pictures; keep material that
   mustn't be public in the private library.
5. Text is lowercase unless the word needs a capital, and every text has a language.

## Other sources

The same steps work without a PDF: for a word list (typed by a teacher, or from a textbook page),
make `extracted.json` by hand (`[{"ref": "1", "image": "media/…", "ocr": "fridge", "size": [w, h]}]`)
or write `deck.json` directly with the standard fields and templates from `new_deck.py`. Cards
without a picture are fine: leave out `image` and the picture templates skip those cards.
