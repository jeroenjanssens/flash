import { GitHub } from '../github'
import {
  allDecks,
  deleteDeck,
  getDeck,
  putDeck,
  putMedia,
  pruneMedia,
  type StoredDeck,
} from '../storage/idb'
import { mediaPaths, mimeType } from './media'
import { parseDeck } from './parse'

/**
 * The deck library: a (private) GitHub repository with one folder per deck. Decks are
 * downloaded into IndexedDB; only files whose git sha changed are downloaded again.
 */

interface TreeEntry {
  path: string
  type: 'blob' | 'tree'
  sha: string
}

export interface LibraryResult {
  added: number
  updated: number
  removed: number
  errors: string[]
}

/** `owner/name`, also accepting a full GitHub URL. */
export function parseRepo(input: string): string | undefined {
  const m = input
    .trim()
    .replace(/^https?:\/\/github\.com\//, '')
    .replace(/\.git$/, '')
    .replace(/\/$/, '')
    .match(/^([\w.-]+)\/([\w.-]+)$/)
  return m ? `${m[1]}/${m[2]}` : undefined
}

export async function syncLibrary(
  token: string,
  repo: string,
  gh = new GitHub(token),
): Promise<LibraryResult> {
  const result: LibraryResult = { added: 0, updated: 0, removed: 0, errors: [] }
  const tree = await gh.json<{ tree: TreeEntry[]; truncated: boolean }>(
    `/repos/${repo}/git/trees/HEAD?recursive=1`,
  )
  const shas = new Map(tree.tree.filter((e) => e.type === 'blob').map((e) => [e.path, e.sha]))
  const folders = [...shas.keys()]
    .filter((p) => p.endsWith('/deck.json') && p.split('/').length === 2)
    .map((p) => p.slice(0, -'/deck.json'.length))
  const seen = new Set<string>()
  for (const folder of folders) {
    try {
      const deckSha = shas.get(`${folder}/deck.json`)!
      const existing = (await allDecks()).find((d) => d.source === 'library' && d.path === folder)
      if (existing && existing.shas?.['deck.json'] === deckSha && (await complete(existing))) {
        seen.add(existing.id)
        continue
      }
      const text = await (await gh.raw(`/repos/${repo}/git/blobs/${deckSha}`)).text()
      const { deck } = parseDeck(JSON.parse(text))
      seen.add(deck.id)
      const before = existing?.id === deck.id ? existing : await getDeck(deck.id)
      const fileShas: Record<string, string> = { 'deck.json': deckSha }
      for (const path of mediaPaths(deck)) {
        const sha = shas.get(`${folder}/${path}`)
        if (!sha) {
          result.errors.push(`${folder}: missing ${path}`)
          continue
        }
        fileShas[path] = sha
        if (before?.shas?.[path] === sha) continue
        const blob = await gh.raw(`/repos/${repo}/git/blobs/${sha}`)
        await putMedia(deck.id, path, { blob: new Blob([blob], { type: mimeType(path) }), sha })
      }
      await pruneMedia(deck.id, mediaPaths(deck))
      await putDeck({
        id: deck.id,
        deck,
        source: 'library',
        path: folder,
        shas: fileShas,
        storedAt: Date.now(),
      })
      if (before) result.updated++
      else result.added++
    } catch (err) {
      result.errors.push(`${folder}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  // Decks that were removed from the library.
  for (const d of await allDecks())
    if (d.source === 'library' && !seen.has(d.id)) {
      await deleteDeck(d.id)
      result.removed++
    }
  return result
}

/** Whether every media file of a stored deck was downloaded (an earlier sync may have failed). */
async function complete(stored: StoredDeck): Promise<boolean> {
  for (const path of mediaPaths(stored.deck)) if (!stored.shas?.[path]) return false
  return true
}
