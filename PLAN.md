# flash — Implementation Plan

A spaced-repetition flashcard app for kids, in English and Dutch. It shows decks of flashcards
(the first one: *Stepping Stones Junior 3B – Theme 1: My home*), schedules them with FSRS, and
offers practice modes, pronunciation in a female and a male voice, statistics, and progress that
syncs between devices through a secret GitHub gist.

It's built like [kana](../kana): Svelte 5, TypeScript and Vite, deployed to GitHub Pages as an
installable PWA that works offline. Code is copied from kana and adapted where it fits (gist
sync and merge, FSRS scheduler, sprint and race, i18n, audio engine, charts).

> **Status (1 November 2026): M0–M9 are implemented.** Where the build differs from this plan:
>
> - **Voices:** American after all: Kokoro `af_heart` and `am_michael`, each word said on its own
>   with a full stop, chosen by ear from 16 voices × 3 ways of making clips. (The British voices
>   tried before: `bf_emma`, `bf_lily`, `bm_george`, `bm_lewis`. Some voices add an "-eh" after a
>   final consonant; `--method carrier` cuts the word out of "I said … twice" to avoid it.)
>   The decks keep British spelling; "gray" etc. are accepted.
> - **Built-in decks:** *Stepping Stones Jr. Theme 1: My Home* (moved out of the private library
>   into the app on 2 November: the pictures are generic) and *Colours* (11 cards, pictures drawn
>   as SVG). The private deck library stays available for material that mustn't be public.
> - **Parent area** without a gate; voices are called *juf* and *meester* (*Miss* and *Sir* in English).
> - **Logo:** two fanned flashcards on blue, so it doesn't look like kana's.
> - **Sound effects** are synthesised in the browser (no sound files to license).
> - **Not built (yet):** distractors from other decks of the same collection (decks have enough
>   cards), letter tiles (for Olivier, later), and example sentences.
> - **Tests:** 39 unit tests and 13 end-to-end tests, each on laptop, iPhone and iPad sizes.

Each decision lists a **default** (what I'll build unless you say otherwise) and the
**alternatives**, with pros and cons. Open questions are numbered **Q1…** and collected at the end.

> **Deadline:** page 1 of the PDF says *"6 november, inleveren / toets = vrijdag"*. Today is
> Sunday 1 November, so Florien's test is on **Friday 6 November**. See Q2 for a proposal to ship
> a first useful version before then.

---

## 1. Concepts

| Term | Meaning |
|---|---|
| **Profile** | A learner (Florien first; a second child later). Has their own progress, settings and records. |
| **Deck** | A set of cards about one topic, e.g. one theme of a school book. Decks can belong to a **collection** (the book). |
| **Card** | One thing to learn, with **fields**: a picture, an English word, a Dutch translation, audio. |
| **Template** | One *direction* of asking a card: what's shown (the **prompt**), what must be given (the **answer**), and what's shown afterwards (the **reveal**). Picture → English word, Dutch → English, listen → pick the picture, … |
| **Answer method** | *How* the answer is given: **type** it, **choose** it from four, or **flip** the card and grade yourself. Independent of the template. |
| **Review item** | A card × an enabled template. Each review item has its own FSRS schedule. |
| **Mode** | What you do on a page: Learn (SRS), Type, Choose, Listen, Flip, Sprint, Race. |

The key design point: **templates and answer methods are separate.** The template decides
*what* is asked, the method decides *how* you answer, and the mode decides *whether it counts*
for the schedule. "See the picture, type the word" is template `picture-to-word` + method `type`.
"See the word, choose the picture" is template `word-to-picture` + method `choose`.

---

## 2. Deck format, revised

The format in `docs/deck-format.md` is a good base. These changes make it future-proof. None of
them is breaking in practice, because no deck has been shipped yet, so it stays `formatVersion: 1`.

### 2.1 Changes

1. **Templates get `prompt` / `answer` / `reveal` instead of `front` / `back`**, plus the
   `methods` they allow. A prompt item can be a field shown as itself, or a text field **spoken**
   instead of shown (`{ "field": "word", "as": "audio" }`), which makes listening and dictation
   templates possible. A template only applies to cards that have all of its fields, so
   `dutch-to-english` skips cards without a translation.
2. **Pronunciation lives on the text value**: `"audio": { "female": "media/audio/…", "male": … }`,
   keyed by the ids in a new deck-level **`voices`** list (gender, language, engine, voice name,
   credit). Audio travels with the deck when it's exported or imported. Fields get `"speak": true`
   to mark which ones should have audio.
3. **Media values get an optional `type`** (MIME type) plus optional **`credit` / `license` /
   `source`**, so self-made or CC-licensed pictures can carry their attribution. Field types are
   `text`, `image` and `audio` now. `video` is reserved: the schema accepts it, but the app doesn't
   show video yet.
4. **Language tags get more specific**: `en-GB` (or `en-US`) instead of `en`, so text-to-speech
   and the typing checks (colour/color) know the variant.
5. **Deck appearance**: an optional **`cover`** (a media path) and **`color`**, for the start screen.
6. **Optional `example` field**: a short example sentence ("The milk is in the fridge."), with
   audio, shown on the reveal. Optional per deck.
7. **Forward compatibility**: the app **ignores unknown properties** (with a console warning)
   instead of rejecting the deck, and keys starting with `x-` are reserved for experiments. The
   JSON Schema stays strict, so mistakes are still caught when *making* a deck. `formatVersion`
   only goes up for breaking changes, and the app migrates older versions when it loads them.
8. **Distractor hints (optional)**: `"confusable": ["<card id>", …]` on a card makes
   multiple-choice prefer those cards as wrong options (fork/knife/spoon, king/queen).

### 2.2 Example

```jsonc
{
  "format": "flash-deck",
  "formatVersion": 1,
  "id": "73b5aac5-585d-4277-9489-c687bb60119b",
  "revision": 2,
  "title": { "en": "My home", "nl": "Mijn huis" },
  "cover": "media/2-02.webp",
  "color": "#e8590c",
  "collection": { "id": "stepping-stones-junior-3b", "title": { "en": "Stepping Stones Junior 3B" }, "position": 1 },
  "language": "en-GB",
  "voices": [
    { "id": "female", "gender": "female", "lang": "en-US", "engine": "kokoro", "voice": "af_heart", "credit": "Kokoro-82M (Apache-2.0)" },
    { "id": "male", "gender": "male", "lang": "en-US", "engine": "kokoro", "voice": "am_michael", "credit": "Kokoro-82M (Apache-2.0)" }
  ],
  "fields": [
    { "id": "image", "type": "image" },
    { "id": "word", "type": "text", "lang": "en-GB", "speak": true },
    { "id": "translation", "type": "text", "lang": "nl", "optional": true },
    { "id": "example", "type": "text", "lang": "en-GB", "optional": true, "speak": true }
  ],
  "templates": [
    { "id": "picture-to-word", "prompt": ["image"], "answer": "word", "reveal": ["word", "translation", "example"], "methods": ["type", "choose", "flip"] },
    { "id": "dutch-to-english", "prompt": ["translation"], "answer": "word", "reveal": ["image", "word"], "methods": ["type", "choose", "flip"] },
    { "id": "word-to-picture", "prompt": ["word"], "answer": "image", "methods": ["choose"], "enabled": false },
    { "id": "listen-to-picture", "prompt": [{ "field": "word", "as": "audio" }], "answer": "image", "methods": ["choose"], "enabled": false },
    { "id": "dictation", "prompt": [{ "field": "word", "as": "audio" }], "answer": "word", "reveal": ["image"], "methods": ["type"], "enabled": false }
  ],
  "cards": [
    {
      "id": "bOHzPRLlmt",
      "ref": "1.1",
      "fields": {
        "image": { "src": "media/1-01.webp", "type": "image/webp", "width": 132, "height": 284 },
        "word": { "text": "fridge", "audio": { "female": "media/audio/female/bOHzPRLlmt.mp3", "male": "media/audio/male/bOHzPRLlmt.mp3" } },
        "translation": { "text": "koelkast" }
      },
      "confusable": [],
      "tags": ["kitchen"]
    }
  ]
}
```

### 2.3 Templates for this deck

| Template | Prompt → answer | Skill it trains | Methods | Default |
|---|---|---|---|---|
| `picture-to-word` | picture → English word | Recall and spelling, the core skill | type · choose · flip | **On** |
| `dutch-to-english` | Dutch word → English word | Translating, probably what the test asks | type · choose · flip | **On** |
| `word-to-picture` | English word → picture | Reading for meaning (easiest) | choose | Off; used in practice |
| `listen-to-picture` | hear the word → picture | Listening | choose | Off; used in Listen practice |
| `dictation` | hear the word → type it | Spelling from sound | type | Off; used in practice |
| `english-to-dutch` | English word → Dutch word | Understanding | type · choose | Off |

**D1. Which templates are scheduled with SRS**
- *Default:* **two**, `picture-to-word` and `dutch-to-english`: 30 cards × 2 = 60 review items.
  The others are available any time as practice, without a schedule.
  *Pros:* a manageable number of reviews per day, focused on recall, the hardest skill and the one
  tested. *Cons:* listening isn't tracked with spaced repetition.
- *Alternative:* all five scheduled. *Pros:* everything is trained in the long run. *Cons:* 150
  review items, which is a lot of daily work for a child, and the easy templates inflate the sense
  of progress.
- *Alternative:* only `picture-to-word`. *Pros:* the fewest reviews. *Cons:* doesn't train Dutch → English.
- ✅ **Decided:** all six templates exist and can be switched on or off **per profile, per deck**
  (in the deck's settings). On by default: `picture-to-word` and `dutch-to-english`.

---

## 3. Features

### 3.1 Start screen and profiles

- **"Who's learning?"** shows a big avatar per profile (emoji or animal plus a colour, chosen by
  the child). With one profile this screen is skipped, and switching happens from the avatar
  in the header.
- **Deck shelf** per profile: deck covers grouped by collection, each with a mastery ring, the
  number due today, and a **test countdown** when a test date is set ("Toets over 5 dagen").
- **A big "Leren" (Learn) button** that starts reviews across all decks with due cards, so a
  child doesn't have to choose.
- **Parent area** (behind a simple gate, see D8): profiles, decks, sync, template choices.

### 3.2 Deck page

Per deck: Learn (with due and new counts), the practice modes, **Cards**, and **Stats**, and a
setting for the test date.

### 3.3 Learn (spaced repetition)

- **FSRS** via `ts-fsrs`, as in kana, with one schedule per review item.
- **Introduce new cards** before quizzing them: picture, word, translation, audio (it plays
  automatically) and the example sentence. Then a quick multiple-choice check.
- **Graduated answer methods (default):** a new or recently forgotten item is asked as
  **multiple choice** first, then **typed** once it has been answered right in a later session.
  Kids get early wins, and real recall is still required to master a card.
- **Grading is automatic** (see D2): correct → *Good*; correct with a hint, or one small typo →
  *Hard*; wrong → *Again*. *Easy* when a mature item is typed correctly on the first try with no
  hesitation. A child never has to judge themselves, though a "flip" mode with self-grading
  exists for parents or older children.
- **Typing help:**
  - Ignores case and surrounding spaces, and treats hyphens and spaces as the same
    (`eco-house` = `eco house`). Accepts `accept` alternatives.
  - **Near misses** (one letter off) get "Bijna! Kijk nog eens" with the wrong letters
    highlighted, and one more try.
  - **Hints**: the number of letters (`_ _ _ _ _ _`), then the first letter, then the audio.
    Using a hint lowers the grade.
  - Input with `autocorrect`, `autocapitalize` and `spellcheck` off, so the iPad keyboard doesn't
    fix the spelling.
- **Short sessions**: about 10 minutes or 20 items, with a progress bar and a cheerful summary
  (mastered cards, words to practise, a "practise my mistakes" button).
- **Test date mode** (see D3): when a deck has a test date, the scheduler makes sure everything
  is reviewed before it and asks for higher retention as the date gets closer.
- **Tricky cards** (leeches, as in kana): flagged after repeated lapses, with a short drill.
- **Undo** the last answer.

### 3.4 Practice modes (no effect on the schedule by default, see D4)

| Mode | What happens | Templates |
|---|---|---|
| **Typen** (Type) | See the picture *or* the Dutch word, type the English word. | `picture-to-word`, `dutch-to-english`, `dictation` |
| **Kiezen** (Choose) | See a word, pick one of 4 pictures; *or* see a picture, pick one of 4 words. | `word-to-picture`, `picture-to-word` |
| **Luisteren** (Listen) | Hear the word, pick one of 4 pictures. | `listen-to-picture` |
| **Omdraaien** (Flip) | Browse the cards like paper flashcards and grade yourself. | any |
| **Sprint** | As many right answers as possible in 1, 2, 3 or 5 minutes; a wrong answer costs 2 seconds. Records per deck, length and method. | choose (fast) or type |
| **Race** | Every card in the deck (or a tag, e.g. "castles") exactly once, as fast as possible. Records per set. | choose or type |

- **Distractors for multiple choice:** cards from the same deck, preferably with the same tag
  or listed as `confusable`, never repeating the right answer's picture. With fewer than 4
  cards, decks from the same collection fill in.
- Every answer, from every mode, goes into the **review log**, which feeds stats and the daily goal.

### 3.5 Cards page

All cards of a deck in a grid: picture, word, translation, ▶ female and ▶ male audio, and a
mastery badge per template. Filter by tag or mastery ("still learning"), search, and switch
between showing the pictures or the words only (a quick self-test). Tapping a card opens its
details: both voices, the example sentence, review history, and common misspellings.

### 3.6 Stats page (per deck, and a summary over all decks)

- **Mastery**: new / learning / known / mastered per template, as a stacked bar.
- **Test readiness** when a test date is set: "Je kent 24 van de 30 woorden".
- **Activity heatmap**, **streak**, **daily goal** (as in kana).
- **Due forecast** for the next 14 days.
- **Hardest words** and **most common misspellings** (from the typed answers in the log).
- **Sprint and race records** with their history.
- A per-profile overview for the parent.

### 3.7 Pronunciation

- Every English `word` (and `example`) gets audio in a **female and a male voice**, generated
  offline and stored in the deck's `media/audio/`. Setting: Female / Male / Random per card (as in kana).
- Play buttons on the reveal, the Cards page and the intro; auto-play on reveal is a setting.
  Listen mode and the `dictation` template use the audio as the prompt.
- **Generation** (see D5): `just audio <deck>` runs a uv script that calls the engine, trims the
  silence, normalises loudness, encodes to MP3 (mono, 64 kbps, about 8 KB per word) and writes the
  `audio` paths into `deck.json`. A **voice preview page** lets you compare voices before choosing, as in kana.

### 3.8 Sync

- As in kana: a **secret GitHub gist**, with the token stored only in the browser. Merging takes
  the most recently reviewed version of each item and the union of the logs, so work is never lost.
- **One gist for the family**, with one file per profile (`flash-<profileId>.json`) and a
  `flash-profiles.json` with the list of profiles. The parent's token is used on every device (see D6).
- **Pairing a device**: the parent area shows a **QR code** (a link with the token in the
  `#fragment`, which never reaches a server). Scan it with the child's iPad and that device is set
  up, with no token typing on a child's device.
- Syncs on start, after each session, and when the app goes to the background; works offline and
  catches up later.

### 3.9 Look & feel (for kids, clean and polished)

- Bright but calm: a white or cream card on a soft background in the deck's colour, big rounded
  shapes, large touch targets (at least 48 px), and one clear action per screen.
- Card words in a font made for beginning readers (see D9), large.
- A satisfying **card flip**, gentle sounds (correct, wrong, flip, finish), **stars or stickers**
  for mastered cards, confetti for a new record or a mastered deck. Respects
  `prefers-reduced-motion`, and sound can be turned off.
- No punishment: a missed day doesn't reset anything dramatic (the streak can "freeze" for a day),
  and no timers outside Sprint and Race.
- Light and dark theme; Dutch and English interface (Dutch by default); works on iPad, phone and laptop.

### 3.10 Offline and installable

PWA via `vite-plugin-pwa`, as in kana. Decks (JSON and media) are cached in **IndexedDB**, so
everything works offline once a deck has been opened. Progress stays in `localStorage` (small) and syncs.

---

## 4. Decks: where they live

The deck's pictures are © Noordhoff, so they shouldn't go in a public repo or a public website.

**D7. Deck distribution** (Q3)
- *Default:* **a private deck repository** (`jeroenjanssens/flash-decks`) with an `index.json`
  listing the decks. The app reads it with the same GitHub token as sync (a fine-grained token:
  Gists read/write + Contents read-only on that one repo), and caches the decks in IndexedDB.
  The public app and repo contain only code and freely licensed decks.
  *Pros:* nothing copyrighted is public; a new deck shows up on every device automatically;
  decks are versioned in git; the agent can add decks with a commit. *Cons:* the app needs the
  token before it can show these decks (it's needed for sync anyway); a bit more code.
- *Alternative:* **import a `.zip`** per device (export and import in the parent area).
  *Pros:* simplest, no token. *Cons:* has to be repeated on every device for every deck; easy to
  end up with different versions.
- *Alternative:* **commit decks to the public repo** as they are. *Pros:* zero effort. *Cons:*
  publishes Noordhoff's pictures, which risks a takedown.
- *Alternative:* **replace the pictures** with your own photos, CC0 images or generated ones,
  so decks can be public. *Pros:* shareable with others. *Cons:* a lot of work per deck, and the
  pictures differ from the ones the teacher uses, which matters for a test with these cards.
- Either way, zip import and export exist as well, for sharing a deck with someone else.

---

## 5. Design decisions

**D2. Grading in Learn** (Q6)
- *Default:* **automatic grading** from typed or chosen answers, as above.
  *Pros:* children consistently overrate themselves when they self-grade; automatic grading is
  honest and needs no explanation. *Cons:* typing is slow on a tablet for some children; a
  correct-but-unsure answer still counts as Good.
- *Alternative:* **self-grade** (Again/Hard/Good/Easy) as in Anki and kana. *Pros:* fast, works
  for any card. *Cons:* unreliable for kids, and four buttons are confusing.
- *Alternative:* auto-grading with only two buttons for flip cards ("I knew it" / "Not yet").
  Available in the Flip mode anyway.

**D3. Test date**
- *Default:* an optional test date per deck **per profile**. Before the date: intervals are capped
  so every item is seen at least once in the final two days, and desired retention goes from 0.9
  to 0.95. After the date: normal FSRS again, so the words stay for the next test or the end of
  the year. *Pros:* matches how school works. *Cons:* more reviews in the last days.
- *Alternative:* no special handling; plain FSRS. *Pros:* simpler. *Cons:* FSRS optimises for the
  long term, and may not show a card before Friday.

**D4. Do practice modes affect the schedule?** (Q5)
- *Default:* **no**, as in kana; they're logged and count for stats and the daily goal.
  *Pros:* the schedule stays clean; sprints (guessing fast) can't push cards into the future.
  *Cons:* a child who only does Sprint never moves cards forward.
- *Alternative:* **correct practice answers count for items that are due** (method type only).
  *Pros:* practice is rewarded. *Cons:* harder to explain, and multiple choice is too easy to count.

**D5. Pronunciation engine** (Q4)
- *Default:* **Kokoro-82M**, run locally with uv. Apache-2.0 model and code, so the audio can be
  redistributed with no credit required (I'll credit it anyway); very natural; has British *and*
  American female and male voices (`bf_lily`, `bf_isabella`, `bm_lewis`, `bm_lewis`, `af_heart`,
  `am_michael`, …). *Cons:* needs `espeak-ng` (Homebrew) for the pronunciation of unknown words;
  English only (not a problem: only the English words need audio).
- *Alternative:* **Piper**. *Pros:* small and fast; has Dutch voices too. *Cons:* clearly more
  robotic; each voice has its own licence.
- *Alternative:* **cloud TTS** (Azure, Google, ElevenLabs). *Pros:* the best quality.
  *Cons:* an account and API key, costs, and terms on redistribution.
- *Alternative:* **the browser's speech synthesis**. *Pros:* no files, works for any deck instantly.
  *Cons:* the quality and the voices differ per device, and on some devices it doesn't work offline.
  Kept as a **fallback** for decks without audio.
- macOS `say` is ruled out: its licence doesn't allow redistributing the output.

**D6. Profiles and sync accounts**
- *Default:* **one family gist, the parent's token, one file per profile**. *Pros:* set up once;
  kids under 13 can't have GitHub accounts anyway; the parent sees everyone's progress.
  *Cons:* a child's device could technically write to a sibling's file (that's acceptable).
- *Alternative:* one gist per profile, each with its own token. *Pros:* separation.
  *Cons:* more setup, and still all on the parent's account.

**D8. Parent gate**
- *Default:* a **simple sum** ("7 × 8 = ?") before the parent area. *Pros:* no PIN to forget;
  keeps young children out of sync settings. *Cons:* an older child can solve it.
- *Alternative:* a 4-digit PIN (synced). *Pros:* properly locked. *Cons:* can be forgotten, and
  needs a reset path.

**D9. Fonts**
- *Default:* **Andika** (SIL, OFL) for the words on cards: designed for beginning readers, with a
  single-storey *a*, a distinct *l / I / 1*, and clear letter shapes, which helps with spelling.
  **Nunito** (rounded, OFL) for the interface. Both self-hosted.
- *Alternative:* **Lexend** for both (designed for reading fluency). *Alternative:* **Atkinson
  Hyperlegible** (made for legibility). Both are excellent; they look more grown-up.

**D10. Code reuse from kana**
- *Default:* **copy and adapt** the modules that fit: `storage/gist.ts`, `storage/merge.ts`,
  `srs/`, `study/sprint.ts` and `race.ts`, `i18n`, `audio/engine.ts`, `charts/`, the router, the
  PWA and CI setup. *Pros:* fast; flash can diverge freely. *Cons:* fixes don't flow between the
  two apps automatically.
- *Alternative:* a shared package used by both. *Pros:* one copy. *Cons:* a lot of refactoring
  in kana, and it slows both projects down.

**D11. Storage**
- *Default:* progress in **`localStorage`** (versioned schema, as in kana); decks and media in
  **IndexedDB**. *Alternative:* everything in IndexedDB: more uniform, but more code for small data.

**D12. Hosting**
- *Default:* GitHub Pages at **`flash.jeroenjanssens.com`** (Q9), deployed by GitHub Actions
  after lint, type-check, unit tests and e2e tests, as in kana.

---

## 6. Architecture

```
flash/
├── decks/                     # only free decks (e.g. a tiny demo deck for tests)
├── schema/deck.schema.json
├── docs/
│   ├── deck-format.md
│   └── making-decks.md        # for people and agents, see §7
├── .claude/skills/new-deck/   # agent skill: PDF → validated deck in the deck repo
├── scripts/
│   ├── extract_pdf_deck.py    # scans → pictures + OCR (generalised, see §7)
│   ├── new_deck.py            # extracted.json → deck.json (ids, uuid, lowercase)
│   ├── generate_audio.py      # Kokoro → media/audio/{voice}/… + deck.json paths
│   └── check_deck.py          # schema + files exist + lowercase + audio + duplicates
├── preview/                   # deck preview page (the one you used)
├── src/
│   ├── lib/                   # plain TypeScript, no Svelte
│   │   ├── deck/              # types, load, validate, migrate, items (card × template)
│   │   ├── srs/               # ts-fsrs scheduler, queue, test-date mode, leeches
│   │   ├── study/             # answer checking, hints, distractors, sprint, race, stats
│   │   ├── storage/           # save schema, migrations, gist, merge, IndexedDB deck store
│   │   ├── audio/             # engine, voices, speech-synthesis fallback, sound effects
│   │   └── i18n/              # nl, en
│   ├── state/                 # $state: profile, decks, sync, router, settings
│   ├── components/            # Card, ChoiceGrid, TypeAnswer, AudioButton, MasteryRing, charts
│   └── views/                 # Profiles, Home, Deck, Learn, Type, Choose, Listen, Flip,
│                              # Sprint, Race, Cards, Stats, Settings, Parent
└── tests/                     # Vitest + Playwright
```

**Routes** (hash routing, as in kana): `#/` (profiles), `#/home`, `#/deck/<id>`,
`#/deck/<id>/learn`, `…/type`, `…/choose`, `…/listen`, `…/flip`, `…/sprint`, `…/race`,
`…/cards`, `…/stats`, `#/settings`, `#/parent`.

**Progress per profile** (one gist file each):

```ts
interface ProfileSave {
  version: 1
  profile: { id: string; name: string; avatar: string; color: string }
  settings: Settings                    // voice, autoplay, sounds, theme, language, daily goal, new per day
  settingsUpdatedAt: number
  decks: Record<DeckId, {
    templates?: string[]                // templates switched on, if different from the deck's
    testDate?: string                   // '2026-11-06'
    items: Record<CardId, Record<TemplateId, { fsrs: FsrsCard; stage: 'choose' | 'type' }>>
  }>
  log: ReviewEntry[]
  records: { sprints: Sprint[]; races: Race[] }
}

interface ReviewEntry {
  t: number; deck: DeckId; card: CardId; template: TemplateId
  mode: 'learn' | 'type' | 'choose' | 'listen' | 'flip' | 'sprint' | 'race'
  method: 'type' | 'choose' | 'flip'
  correct: boolean; grade?: 1 | 2 | 3 | 4; hints: number; ms: number
  answered?: string                     // what was typed or chosen → misspellings, confusions
}
```

When a deck gets a new revision, progress is kept per card id and template id. Cards that
disappeared are kept in the save (not shown), so they come back if the card returns.

---

## 7. Making new decks (instructions for agents)

- **`docs/making-decks.md`**: the full recipe, written for both people and agents:
  1. Look at the source (PDF pages): the grid size; which pages have pictures and which have words;
     whether the back pages are **mirrored** (common with double-sided printing: the left column
     on the front matches the right column on the back); the rotation; handwriting to ignore.
  2. Run `extract_pdf_deck.py` with the right options and **check the contact sheet** it makes.
  3. Run `new_deck.py` to create `deck.json`, then curate it: lowercase except names, `I`, and
     languages and days in English; `accept` alternatives; tags; Dutch translations (marked as
     added, checked by a parent); `confusable` sets; the source and copyright.
  4. `just audio <deck>`, then listen to every word on the preview page.
  5. `just check <deck>`, then commit to the deck repo and bump `revision` on later changes.
  6. Rules that must never be broken: never change a card `id` or the deck `id`; never delete a
     card that has been studied (suspend it instead); never put copyrighted decks in the public repo.
- **A project skill, `.claude/skills/new-deck/SKILL.md`**, that points to the doc, runs the steps,
  and stops for review (contact sheet, preview page) before committing.
- **`extract_pdf_deck.py` gets options**: `--rows --cols`, `--mirrored`, `--line-color`,
  `--pages`, a word-pages-first layout, and a **contact sheet** output. It also gets a fallback for
  phone photos (perspective correction from the outer frame), for when a sheet is photographed
  instead of scanned.
- Other sources the agent can handle with the same format: a word list typed by a teacher (CSV or
  text → deck with a Dutch translation, pictures optional), a textbook page with a vocabulary
  box, or an existing Anki `.apkg` (`import_anki.py`, later).

---

## 8. Milestones

Ordered so something useful exists before Friday's test (Q2).

| # | Milestone | Contents |
|---|---|---|
| **M0** | Scaffold and deploy | Vite + Svelte 5 + TS, lint, svelte-check, Vitest, Playwright, CI → Pages. |
| **M1** | Deck format v1 final | Schema changes (§2.1), TS types, loader with validation, `check_deck.py`, preview page updated, this deck migrated. |
| **M2** | Audio | Voice preview page → you pick two voices → `generate_audio.py` → audio for all 30 words. |
| **M3** | **MVP for the test** | Florien's profile (local), deck page, **Learn** with intro, choose → type, hints, near misses, auto-grading, audio, **test date mode**, session summary. Dutch UI. Deck loaded from a local file (zip import) so the private-repo question doesn't block it. |
| **M4** | Practice | Type, Choose, Listen, Flip. |
| **M5** | Sync and decks | Family gist with profile files, merge, QR pairing, private deck repo, IndexedDB cache, parent area. |
| **M6** | Sprint and Race | With records per deck, set and method. |
| **M7** | Cards and Stats | Cards page; stats per deck and overall; misspellings; readiness. |
| **M8** | Polish | Look and feel, sound effects, stickers, confetti, dark theme, English UI, PWA offline, accessibility, e2e on iPad and phone sizes. |
| **M9** | Deck making | `making-decks.md`, the skill, the generalised extraction script, `new_deck.py`. |

M0–M3 is about two days of work, so it can be ready by **Wednesday 4 November**, which leaves
Florien Wednesday to Friday to practise. A plain deploy of the M3 build doesn't publish the deck,
because it's imported on the device.

---

## 9. Decisions (2 November 2026)

| # | Question | Decision |
|---|---|---|
| Q1 | Name | ✅ **Florien** |
| Q2 | MVP before the test | ✅ Build it all, in the milestone order above |
| Q3 | Copyrighted decks | ✅ **Private deck repo** (`jeroenjanssens/flash-decks`), plus zip import and export |
| Q4 | English variant and engine | ✅ British spelling, **American voices** (Kokoro `af_heart` and `am_michael`, picked by ear) |
| Q5 | Practice modes and the schedule | ✅ **No effect** on the schedule; logged for stats and the daily goal |
| Q6 | Grading in Learn | ✅ **Automatic**, graduated choose → type; self-grading available as a setting |
| Q7 | Templates | ✅ **All six templates** (including `english-to-dutch`), **selectable per profile and deck**. On by default: `picture-to-word` and `dutch-to-english` |
| Q8 | Devices | ✅ iPad, iPhone and laptop: every screen works with touch, an on-screen keyboard and a real keyboard. Letter tiles wait for Olivier |
| Q9 | Domain | ✅ `flash.jeroenjanssens.com` |
| Q10 | Translations and examples | ✅ Keep the translations; example sentences later |
| Q11 | What the test asks | Unknown, so both scheduled templates train it: picture → word and Dutch → English |
| Q12 | Parent gate | ✅ A sum |
| Q13 | Second child | ✅ **Olivier**, 8. Same app, own profile, no deck of his own yet |
