import { mediaPaths } from '../lib/deck/media'
import { parseDeck } from '../lib/deck/parse'
import { syncLibrary, type LibraryResult } from '../lib/deck/library'
import type { Deck } from '../lib/deck/types'
import { packDeck, unpackDeck, folderName } from '../lib/deck/zip'
import {
  allDecks,
  deckMedia,
  deleteDeck,
  getDeck,
  putDeck,
  putMedia,
  pruneMedia,
} from '../lib/storage/idb'
import { KEYS } from '../lib/storage/persistence'

export type DeckSource = 'builtin' | 'library' | 'import'

export interface LoadedDeck {
  deck: Deck
  source: DeckSource
  /** For built-in decks: the folder under public/decks/. */
  folder?: string
}

/** All decks on this device. Built-in decks come with the app; others live in IndexedDB. */
export const decks = $state<{ list: LoadedDeck[]; loaded: boolean; error: string }>({
  list: [],
  loaded: false,
  error: '',
})

const BASE = import.meta.env.BASE_URL
/** Object URLs for media stored in IndexedDB, per deck. */
const objectUrls = new Map<string, Map<string, string>>()

export function deckById(id: string): LoadedDeck | undefined {
  return decks.list.find((d) => d.deck.id === id)
}

/** The URL of a deck's media file (a picture or an audio clip). */
export function mediaUrl(loaded: LoadedDeck, src: string | undefined): string | undefined {
  if (!src) return undefined
  if (loaded.source === 'builtin') return `${BASE}decks/${loaded.folder}/${src}`
  return objectUrls.get(loaded.deck.id)?.get(src)
}

async function loadBuiltins(): Promise<LoadedDeck[]> {
  try {
    const res = await fetch(`${BASE}decks/index.json`)
    if (!res.ok) return []
    const { decks: folders } = (await res.json()) as { decks: string[] }
    const out: LoadedDeck[] = []
    for (const folder of folders) {
      try {
        const r = await fetch(`${BASE}decks/${folder}/deck.json`)
        out.push({ deck: parseDeck(await r.json()).deck, source: 'builtin', folder })
      } catch (err) {
        console.warn(`Could not load the built-in deck ${folder}`, err)
      }
    }
    return out
  } catch {
    return []
  }
}

async function urlsFor(deckId: string): Promise<void> {
  const old = objectUrls.get(deckId)
  if (old) for (const url of old.values()) URL.revokeObjectURL(url)
  const urls = new Map<string, string>()
  for (const [path, media] of await deckMedia(deckId))
    urls.set(path, URL.createObjectURL(media.blob))
  objectUrls.set(deckId, urls)
}

async function loadStored(): Promise<LoadedDeck[]> {
  try {
    const stored = await allDecks()
    await Promise.all(stored.map((s) => urlsFor(s.id)))
    return stored.map((s) => ({ deck: s.deck, source: s.source }))
  } catch (err) {
    console.warn('Could not read stored decks', err)
    return []
  }
}

/**
 * Decks in the order they came (built-in decks as listed in public/decks/index.json, then the
 * others), with decks of the same collection together and in their collection's order.
 */
function sortDecks(list: LoadedDeck[]): LoadedDeck[] {
  const groupOrder = new Map<string, number>()
  list.forEach((d, i) => {
    const key = d.deck.collection?.id ?? `deck:${d.deck.id}`
    if (!groupOrder.has(key)) groupOrder.set(key, i)
  })
  const group = (d: LoadedDeck) => groupOrder.get(d.deck.collection?.id ?? `deck:${d.deck.id}`)!
  return list
    .map((d, i) => ({ d, i }))
    .sort(
      (a, b) =>
        group(a.d) - group(b.d) ||
        (a.d.deck.collection?.position ?? 0) - (b.d.deck.collection?.position ?? 0) ||
        a.i - b.i,
    )
    .map((x) => x.d)
}

export async function loadDecks(): Promise<void> {
  const [builtin, stored] = await Promise.all([loadBuiltins(), loadStored()])
  // The same deck can be built in and stored (imported, or from the library): the newest
  // revision wins, and the built-in copy on a tie (it's updated with the app).
  const byId = new Map<string, LoadedDeck>()
  for (const d of [...builtin, ...stored]) {
    const other = byId.get(d.deck.id)
    if (!other || d.deck.revision > other.deck.revision) byId.set(d.deck.id, d)
  }
  decks.list = sortDecks([...byId.values()])
  decks.loaded = true
}

export function deckRepo(): string {
  return localStorage.getItem(KEYS.deckRepo) ?? ''
}

export async function refreshLibrary(): Promise<LibraryResult | undefined> {
  const token = localStorage.getItem(KEYS.token)
  const repo = deckRepo()
  if (!token || !repo) return undefined
  const result = await syncLibrary(token, repo)
  if (result.added || result.updated || result.removed) await loadDecks()
  return result
}

export type ImportResult = { kind: 'added' | 'updated' | 'older'; deck: Deck; warnings: string[] }

/** Import a deck from a zip. A copy with a lower revision than the one on the device is refused. */
export async function importZip(data: Uint8Array, force = false): Promise<ImportResult> {
  const { deck, warnings, media } = unpackDeck(data)
  const existing = (await getDeck(deck.id)) ?? deckById(deck.id)
  if (existing && existing.deck.revision > deck.revision && !force)
    return { kind: 'older', deck, warnings }
  for (const [path, blob] of media) await putMedia(deck.id, path, { blob })
  await pruneMedia(deck.id, mediaPaths(deck))
  await putDeck({ id: deck.id, deck, source: 'import', storedAt: Date.now() })
  await loadDecks()
  return { kind: existing ? 'updated' : 'added', deck, warnings }
}

export async function exportZip(loaded: LoadedDeck): Promise<{ blob: Blob; name: string }> {
  const folder = folderName(loaded.deck)
  const blob = await packDeck($state.snapshot(loaded.deck) as Deck, folder, async (src) => {
    const url = mediaUrl(loaded, src)
    if (!url) return undefined
    const res = await fetch(url)
    return res.ok ? res.blob() : undefined
  })
  return { blob, name: `${folder}.zip` }
}

export async function removeDeck(id: string): Promise<void> {
  await deleteDeck(id)
  const urls = objectUrls.get(id)
  if (urls) for (const url of urls.values()) URL.revokeObjectURL(url)
  objectUrls.delete(id)
  await loadDecks()
}
