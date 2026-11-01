# flash — common development tasks. Run `just` to list them.

default:
    @just --list

# Install dependencies
install:
    npm install

# Start the development server (http://localhost:5173/)
dev:
    npm run dev

# Build the production bundle into dist/
build:
    npm run build

# Type-check Svelte and TypeScript
check:
    npm run check

# Lint and check formatting
lint:
    npm run lint

# Format all files
format:
    npm run format

# Run unit tests
test:
    npm test

# Run end-to-end tests (laptop, iPhone and iPad sizes)
e2e:
    npm run test:e2e

# Everything CI runs
ci: lint check test build e2e

# Check decks: schema, files, audio, ids (default: the built-in decks)
check-deck +decks="public/decks/colours":
    uv run scripts/check_deck.py {{decks}}

# Generate pronunciation for a deck with Kokoro (needs espeak-ng and ffmpeg)
audio deck *args:
    uv run scripts/generate_audio.py {{deck}} {{args}}

# Compare Kokoro voices on a page in voice-preview/
voices deck:
    uv run scripts/generate_audio.py {{deck}} --preview voice-preview

# Check a deck by eye: every card, both sides, both voices (http://localhost:8000/)
preview deck port="8000":
    uv run scripts/serve_preview.py {{deck}} {{port}}

# Extract pictures and words from a PDF of scanned flash cards (see docs/making-decks.md)
extract pdf out *args:
    uv run scripts/extract_pdf_deck.py {{pdf}} {{out}} {{args}}

# Turn extracted cards into a deck.json to curate (see docs/making-decks.md)
new-deck extracted out *args:
    uv run scripts/new_deck.py {{extracted}} {{out}} {{args}}

# Rebuild the built-in Colours deck
demo-deck:
    uv run scripts/make_demo_deck.py

# Render the app icons from public/favicon.svg
icons:
    node scripts/make-icons.mjs
