/**
 * A tiny IndexedDB wrapper for decks that don't come with the app (from the deck library or a
 * zip): their deck.json and their media, so they work offline.
 */
import type { Deck } from '../deck/types'

export interface StoredDeck {
  id: string
  deck: Deck
  source: 'library' | 'import'
  /** For library decks: the folder in the repository. */
  path?: string
  /** Git blob sha per file (deck.json and media), to download only what changed. */
  shas?: Record<string, string>
  storedAt: number
}

export interface StoredMedia {
  blob: Blob
  sha?: string
}

const DB_NAME = 'flash'
const DB_VERSION = 1

let opening: Promise<IDBDatabase> | undefined

function db(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const d = req.result
      if (!d.objectStoreNames.contains('decks')) d.createObjectStore('decks', { keyPath: 'id' })
      if (!d.objectStoreNames.contains('media')) d.createObjectStore('media')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      opening = undefined
      reject(req.error)
    }
  })
  return opening
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function store(name: 'decks' | 'media', mode: IDBTransactionMode = 'readonly') {
  return (await db()).transaction(name, mode).objectStore(name)
}

const mediaKey = (deckId: string, src: string) => `${deckId}/${src}`
const deckRange = (deckId: string) => IDBKeyRange.bound(`${deckId}/`, `${deckId}/￿`)

export async function allDecks(): Promise<StoredDeck[]> {
  return wrap((await store('decks')).getAll() as IDBRequest<StoredDeck[]>)
}

export async function getDeck(id: string): Promise<StoredDeck | undefined> {
  return wrap((await store('decks')).get(id) as IDBRequest<StoredDeck | undefined>)
}

export async function putDeck(deck: StoredDeck): Promise<void> {
  await wrap((await store('decks', 'readwrite')).put(deck))
}

export async function getMedia(deckId: string, src: string): Promise<StoredMedia | undefined> {
  return wrap(
    (await store('media')).get(mediaKey(deckId, src)) as IDBRequest<StoredMedia | undefined>,
  )
}

export async function putMedia(deckId: string, src: string, media: StoredMedia): Promise<void> {
  await wrap((await store('media', 'readwrite')).put(media, mediaKey(deckId, src)))
}

/** Every media file of a deck, keyed by its path inside the deck. */
export async function deckMedia(deckId: string): Promise<Map<string, StoredMedia>> {
  const s = await store('media')
  const range = deckRange(deckId)
  const [keys, values] = await Promise.all([
    wrap(s.getAllKeys(range)),
    wrap(s.getAll(range) as IDBRequest<StoredMedia[]>),
  ])
  const out = new Map<string, StoredMedia>()
  keys.forEach((k, i) => out.set(String(k).slice(deckId.length + 1), values[i]))
  return out
}

/** Remove media of a deck that it no longer uses. */
export async function pruneMedia(deckId: string, keep: Set<string>): Promise<void> {
  const s = await store('media', 'readwrite')
  const keys = await wrap(s.getAllKeys(deckRange(deckId)))
  for (const k of keys) if (!keep.has(String(k).slice(deckId.length + 1))) s.delete(k)
}

export async function deleteDeck(id: string): Promise<void> {
  await wrap((await store('media', 'readwrite')).delete(deckRange(id)))
  await wrap((await store('decks', 'readwrite')).delete(id))
}
