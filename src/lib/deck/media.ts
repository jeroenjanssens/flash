import { isMedia, isText, type Deck } from './types'

/** Every media file a deck refers to: the cover, pictures and other media, and audio. */
export function mediaPaths(deck: Deck): Set<string> {
  const paths = new Set<string>()
  if (deck.cover) paths.add(deck.cover)
  for (const card of deck.cards)
    for (const v of Object.values(card.fields)) {
      if (isMedia(v)) paths.add(v.src)
      if (isText(v)) for (const src of Object.values(v.audio ?? {})) paths.add(src)
    }
  return paths
}

const TYPES: Record<string, string> = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  mp4: 'video/mp4',
  webm: 'video/webm',
}

export function mimeType(path: string): string {
  return TYPES[path.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream'
}
