# The Flash deck format (version 1)

A deck is a folder, or when exported, a `.zip` of that folder:

```
my-deck/
├── deck.json            the deck: metadata, fields, templates and cards
└── media/               pictures and sound used by the cards
    ├── 1-01.webp
    └── audio/
        ├── female/<card id>-word.mp3
        ├── male/<card id>-word.mp3
        └── sources.json  (which text each clip was made from; used by generate_audio.py)
```

`deck.json` is described by [`schema/deck.schema.json`](../schema/deck.schema.json), and
`just check <deck dir>` checks everything the schema can't (files exist, ids are unique, audio
is complete, …). The ideas come from Anki:

- **Fields** say what every card contains (like an Anki note type): a picture, a word, a translation.
- **Templates** are the ways a card is asked: what's shown (`prompt`), what must be given
  (`answer`), and what's shown afterwards (`reveal`). Every card is studied once per template
  that's switched on, and each of those *review items* has its own schedule.
- **Answer methods** say how an answer can be given: `type` it, `choose` it from four, or `flip`
  the card and grade yourself. The app picks the method; the template lists the ones that make sense.

## Example

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/jeroenjanssens/flash/main/schema/deck.schema.json",
  "format": "flash-deck",
  "formatVersion": 1,
  "id": "73b5aac5-585d-4277-9489-c687bb60119b",   // a UUID; never changes
  "revision": 2,                                   // +1 on every change to the content
  "createdAt": "2026-11-01T18:00:00+01:00",
  "updatedAt": "2026-11-02T09:00:00+01:00",
  "title": { "en": "My home", "nl": "Mijn huis" },
  "description": { "en": "…", "nl": "…" },
  "cover": "media/2-02.webp",                      // shown on the start screen
  "color": "#e8590c",
  "collection": {                                  // decks that belong together (a book)
    "id": "stepping-stones-junior-3b",
    "title": { "en": "Stepping Stones Junior 3B", "nl": "Stepping Stones Junior 3B" },
    "position": 1
  },
  "language": "en-GB",                             // the language being learned
  "tags": ["english", "vocabulary"],
  "source": { "title": "…", "publisher": "…", "copyright": "…" },
  "voices": [
    { "id": "female", "gender": "female", "lang": "en-GB", "engine": "kokoro", "voice": "bf_lily",
      "credit": "Kokoro-82M by hexgrad", "license": "Apache-2.0" },
    { "id": "male", "gender": "male", "lang": "en-GB", "engine": "kokoro", "voice": "bm_lewis",
      "credit": "Kokoro-82M by hexgrad", "license": "Apache-2.0" }
  ],
  "fields": [
    { "id": "image", "type": "image", "name": { "en": "Picture", "nl": "Plaatje" } },
    { "id": "word", "type": "text", "lang": "en-GB", "speak": true, "name": { "en": "Word", "nl": "Woord" } },
    { "id": "translation", "type": "text", "lang": "nl", "optional": true }
  ],
  "templates": [
    { "id": "picture-to-word", "prompt": ["image"], "answer": "word", "reveal": ["translation"],
      "methods": ["type", "choose", "flip"] },
    { "id": "listen-to-picture", "prompt": [{ "field": "word", "as": "audio" }], "answer": "image",
      "methods": ["choose"], "enabled": false }
  ],
  "cards": [
    {
      "id": "bOHzPRLlmt",                          // never changes: progress is stored per id
      "ref": "1.1",                                // the number printed on the source card
      "fields": {
        "image": { "src": "media/1-01.webp", "type": "image/webp", "width": 132, "height": 284 },
        "word": {
          "text": "fridge",
          "audio": { "female": "media/audio/female/bOHzPRLlmt-word.mp3", "male": "media/audio/male/bOHzPRLlmt-word.mp3" }
        },
        "translation": { "text": "koelkast" }
      },
      "confusable": ["…"],                         // cards that look alike: preferred as wrong options
      "tags": ["kitchen"]
    }
  ]
}
```

## Fields

| Property | Meaning |
|---|---|
| `id` | Lowercase id, used by templates and in the cards' `fields`. |
| `type` | `text`, `image` or `audio`. `video` is reserved: it's valid, but the app doesn't show it yet. |
| `lang` | Required for text: a [BCP 47](https://www.rfc-editor.org/info/bcp47) tag. Be specific for the language being learned (`en-GB`, not `en`): text-to-speech and spelling depend on it. |
| `speak` | This text should have pronunciation audio (one clip per voice). |
| `optional` | Cards may leave this field out. Templates that need it skip those cards. |
| `name` | Name shown in the app, per interface language. |

**Values** in a card:

- Text: `{ "text": "fridge" }`, plus optionally `lang` (overrides the field's, e.g. a French word
  in an English deck), `accept` (other answers that count as correct when typing, e.g.
  `"drawbridge"` for `"draw bridge"`), `hint`, and `audio` (a path per voice id).
- Media: `{ "src": "media/…" }`, plus optionally `type` (MIME type), `width` and `height` (so the
  app can reserve space), `alt`, `credit`, `license` and `source`.

## Templates

| Property | Meaning |
|---|---|
| `prompt` | What's shown as the question: field ids, or `{ "field": "word", "as": "audio" }` to play a text field's audio instead of showing it. |
| `answer` | The field that has to be given. Text can be typed or chosen; a picture can only be chosen. |
| `reveal` | Extra fields shown after answering, next to the answer. |
| `methods` | The answer methods that make sense: `type`, `choose`, `flip`. |
| `enabled` | Studied with spaced repetition by default (`true` if left out). Each learner can switch templates on and off per deck. |

A template applies to a card only if the card has every field the template uses. Spoken
prompts also need audio, or the app falls back to the device's speech synthesis.

## Rules

- **Every text has a language.** Interface text (`title`, `description`, `name`s) is a map from
  a language tag to the text, so it can be shown in English or Dutch. Card text gets its
  language from its field, or from its own `lang`.
- **Text is written as it's learned**: lowercase, unless the word itself needs a capital (names,
  `I`, days and languages in English, German nouns, …).
- **Ids are forever.** The deck `id` and the card `id`s never change, even when a word is
  corrected, so importing a newer revision keeps the learning progress. To stop studying a
  card, set `"suspended": true` instead of deleting it.
- **Bump `revision`** (and `updatedAt`) on every change, so the app knows to update its copy.
- **Media** live in `media/` and are referenced by relative paths (no `..`).
- **Unknown properties**: the schema rejects them, so mistakes are caught while making a deck,
  but the app ignores them, so an older app can still open a newer deck. Properties starting with
  `x-` are free for experiments. `formatVersion` only goes up for breaking changes.

## Importing

An import matches decks on `id`. A new deck is added; a deck with a higher `revision` replaces
the old copy, and the progress of every card with the same `id` (and template id) is kept.
Progress on cards that were removed is kept too, in case they come back.
