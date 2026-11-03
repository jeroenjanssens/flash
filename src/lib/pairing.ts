import { parseRepo } from './deck/library'

/** What a pairing link (`…#/pair?t=<token>&g=<gist>&r=<deck repo>`) sets up. */
export interface Pairing {
  token: string
  gist?: string
  repo?: string
}

/** Read a pairing link, e.g. from a scanned QR code. Undefined if it isn't one. */
export function parsePairingLink(text: string): Pairing | undefined {
  const hash = text.trim().split('#')[1]
  if (!hash) return undefined
  const [path, search = ''] = hash.split('?')
  if (path.replace(/^\/+|\/+$/g, '') !== 'pair') return undefined
  const params = new URLSearchParams(search)
  const token = params.get('t')?.trim()
  if (!token) return undefined
  const gist = params.get('g')?.trim() || undefined
  const repo = parseRepo(params.get('r') ?? '')
  return { token, gist, repo }
}
