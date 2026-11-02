# flash

**Flashcards with spaced repetition, made for kids**, in Dutch and English.

**→ https://flash.jeroenjanssens.com/**

Flash shows decks of flashcards (a picture, an English word, its Dutch translation and its
pronunciation) and knows which ones you still need to practise.

## Features

- **Learn** with spaced repetition (FSRS, as in Anki). New words are introduced first, then
  asked as multiple choice, then typed. Answers are graded automatically: one small typo gets
  "Almost!" and another try, hints show the letters bit by bit.
- **A test date** per deck: Flash makes sure every card comes back before the test, and repeats
  more often in the last week.
- **Templates**: every card can be asked in six ways (picture → English, Dutch → English,
  English → picture, listen → picture, listen → spell, English → Dutch), each with its own
  schedule. Choose per learner and deck which ones to learn.
- **Practice** that doesn't touch the schedule: type, choose, listen, flip cards, a **sprint**
  (as many as you can in 1–5 minutes) and a **race** (every card once, as fast as you can),
  with records.
- **All cards** of a deck with both voices, and **statistics**: what you know, practice per day,
  what's coming up, the hardest words and the most common misspellings.
- **Pronunciation** in a female and a male American voice (*juf* and *meester*), made with Kokoro.
- **Profiles** for every child, with a streak and a daily goal, and a **parent area**.
- **Sync** between iPad, iPhone and laptop through one secret GitHub gist for the family; a
  second device is set up by scanning a QR code.
- **Decks** come with the app (*Stepping Stones Jr. Theme 1: My Home* and *Colours*), or from a
  private **deck library** on GitHub, or a zip. See [docs/deck-format.md](docs/deck-format.md).
- **Works offline** and can be installed as an app.

## Decks

A deck is a folder with a `deck.json` and a `media/` folder: [docs/deck-format.md](docs/deck-format.md)
and the [JSON Schema](schema/deck.schema.json). How to make one from scanned flash cards (for
people and agents): [docs/making-decks.md](docs/making-decks.md).

## Development

You need Node.js 22+, [just](https://github.com/casey/just) and, for decks,
[uv](https://docs.astral.sh/uv/).

```sh
just install   # install dependencies
just dev       # start the dev server at http://localhost:5173/
just test      # unit tests (Vitest)
just e2e       # end-to-end tests (Playwright) on laptop, iPhone and iPad sizes
just ci        # lint, type-check, unit tests, build and e2e: what CI runs
```

Deck tools: `just extract`, `just new-deck`, `just audio`, `just voices`, `just check-deck` and
`just preview` (see `just --list`).

## License

The code is MIT licensed. The built-in Colours deck is CC0. Other decks keep the copyright of
their source, which is recorded in each `deck.json`. Voices: Kokoro-82M (Apache-2.0). Fonts:
Nunito and Andika (SIL Open Font License).
