# The Flash deck format

A deck is a folder (or, when exported, a `.zip` of that folder):

```
my-deck/
├── deck.json      the deck: metadata, fields, templates and cards
└── media/         pictures (and later sound) used by the cards
    ├── 1-01.webp
    └── …
```

`deck.json` is validated by [`schema/deck.schema.json`](../schema/deck.schema.json). The ideas
come from Anki: a deck declares its **fields** (what every card contains, like an Anki note
type) and its **templates** (which fields go on the front and the back). Every card is studied
once per enabled template, and each of those gets its own schedule.

## Example

```jsonc
{
  "$schema": "../../schema/deck.schema.json",
  "format": "flash-deck",
  "formatVersion": 1,
  "id": "73b5aac5-585d-4277-9489-c687bb60119b", // UUID, never changes
  "revision": 1,                                 // +1 on every change
  "createdAt": "2026-11-01T18:00:00+01:00",
  "updatedAt": "2026-11-01T18:00:00+01:00",
  "title": { "en": "My home", "nl": "Mijn huis" },
  "description": { "en": "…", "nl": "…" },
  "collection": {                                // decks that belong together
    "id": "stepping-stones-junior-3b",
    "title": { "en": "Stepping Stones Junior 3B" },
    "position": 1
  },
  "language": "en",                              // the language being learned
  "tags": ["english", "vocabulary"],
  "source": { "title": "…", "publisher": "…", "copyright": "…" },
  "fields": [
    { "id": "image", "type": "image", "name": { "en": "Picture", "nl": "Plaatje" } },
    { "id": "word", "type": "text", "lang": "en", "name": { "en": "Word", "nl": "Woord" } },
    { "id": "translation", "type": "text", "lang": "nl", "optional": true }
  ],
  "templates": [
    { "id": "picture-to-word", "front": ["image"], "back": ["word", "translation"], "answer": "word" },
    { "id": "word-to-picture", "front": ["word"], "back": ["image"], "enabled": false }
  ],
  "cards": [
    {
      "id": "bOHzPRLlmt",                        // never changes: progress is stored per id
      "ref": "1.1",                              // number printed on the source card
      "fields": {
        "image": { "src": "media/1-01.webp", "width": 132, "height": 284 },
        "word": { "text": "fridge" },
        "translation": { "text": "koelkast" }
      },
      "tags": ["kitchen"]
    }
  ]
}
```

## Rules

- **Every text has a language.** Interface text (`title`, `description`, field and template
  `name`s) is a map from a [BCP 47](https://www.rfc-editor.org/info/bcp47) tag to the text, so
  it can be shown in English or Dutch. Card text gets its language from its field's `lang`; a
  single value can override it with its own `lang` (e.g. a French word in an English deck).
- **Text is written as it should be learned**: lowercase, unless the word itself needs a
  capital (names, `I`, German nouns, …).
- **Ids are forever.** The deck `id` and the card `id`s never change, even when a word is
  corrected, so importing a newer revision of a deck keeps the learning progress. A card that
  should no longer be studied gets `"suspended": true` instead of being removed.
- **`accept`** lists other spellings that count as correct when typing the answer
  (`"draw bridge"` also accepts `"drawbridge"`).
- **Media** live in `media/` and are referenced by a relative `src`. `width` and `height` let the
  app reserve space before the picture is loaded.

## Importing

An import matches decks on `id`. If the deck is new it's added; if the incoming `revision` is
higher, the content is replaced while the progress of cards with the same `id` is kept.
