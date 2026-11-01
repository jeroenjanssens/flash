import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { mediaPaths, mimeType } from './media'
import { parseDeck } from './parse'
import type { Deck } from './types'

export interface UnpackedDeck {
  deck: Deck
  warnings: string[]
  media: Map<string, Blob>
}

/**
 * Read a deck from a zip: deck.json at the top, or in one folder (as when a deck folder is
 * zipped), with its media/ next to it. Only files the deck uses are kept.
 */
export function unpackDeck(data: Uint8Array): UnpackedDeck {
  const files = unzipSync(data, {
    filter: (f) => !f.name.startsWith('__MACOSX/') && !f.name.endsWith('/'),
  })
  const deckPath = Object.keys(files)
    .filter((n) => n === 'deck.json' || n.endsWith('/deck.json'))
    .sort((a, b) => a.length - b.length)[0]
  if (!deckPath) throw new Error('no deck.json in the zip')
  const prefix = deckPath.slice(0, -'deck.json'.length)
  const { deck, warnings } = parseDeck(JSON.parse(strFromU8(files[deckPath])))
  const media = new Map<string, Blob>()
  for (const path of mediaPaths(deck)) {
    const bytes = files[prefix + path]
    if (bytes) media.set(path, new Blob([bytes as BlobPart], { type: mimeType(path) }))
    else warnings.push(`missing ${path}`)
  }
  return { deck, warnings, media }
}

/** A zip with deck.json and media/, in a folder named after the deck. */
export async function packDeck(
  deck: Deck,
  folder: string,
  load: (src: string) => Promise<Blob | undefined>,
): Promise<Blob> {
  const files: Record<string, Uint8Array> = {
    [`${folder}/deck.json`]: strToU8(JSON.stringify(deck, null, 2) + '\n'),
  }
  for (const path of mediaPaths(deck)) {
    const blob = await load(path)
    if (blob) files[`${folder}/${path}`] = new Uint8Array(await blob.arrayBuffer())
  }
  // Media are already compressed; deck.json is small. Storing is fast and just as small.
  const zipped = zipSync(files, { level: 0 })
  return new Blob([zipped as BlobPart], { type: 'application/zip' })
}

/** A folder name for a deck: its English title, made safe. */
export function folderName(deck: Deck): string {
  const title = deck.title.en ?? Object.values(deck.title)[0] ?? deck.id
  return (
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_]+/g, '-')
      .slice(0, 60) || 'deck'
  )
}
