import { METHODS, type Deck, type PromptItem } from './types'

/** The newest deck format this app can read. */
export const FORMAT_VERSION = 1

export class DeckError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid' | 'newer' = 'invalid',
  ) {
    super(message)
  }
}

const KNOWN_DECK_KEYS = new Set([
  '$schema',
  'format',
  'formatVersion',
  'id',
  'revision',
  'createdAt',
  'updatedAt',
  'title',
  'description',
  'cover',
  'color',
  'collection',
  'language',
  'tags',
  'source',
  'voices',
  'fields',
  'templates',
  'cards',
])

const MEDIA_PATH = /^media\/([A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*$/

export function isMediaPath(path: string): boolean {
  return MEDIA_PATH.test(path)
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

export const promptField = (item: PromptItem): string =>
  typeof item === 'string' ? item : item.field

/**
 * Check a parsed deck.json and return it as a Deck, with warnings for things the app ignores.
 * Unknown properties are ignored (so an older app can open a newer deck); what the app needs to
 * work is checked strictly. Throws a DeckError when the deck can't be used.
 */
export function parseDeck(json: unknown): { deck: Deck; warnings: string[] } {
  const warnings: string[] = []
  const fail = (message: string): never => {
    throw new DeckError(message)
  }
  if (!isObject(json)) fail('deck.json is not an object')
  const d = json as Record<string, unknown>
  if (d.format !== 'flash-deck') fail('not a Flash deck (format should be "flash-deck")')
  if (typeof d.formatVersion !== 'number') fail('formatVersion is missing')
  if ((d.formatVersion as number) > FORMAT_VERSION)
    throw new DeckError('this deck needs a newer version of Flash', 'newer')
  if (typeof d.id !== 'string' || !d.id) fail('id is missing')
  if (typeof d.revision !== 'number') fail('revision is missing')
  if (!isObject(d.title) || !Object.keys(d.title).length) fail('title is missing')
  if (typeof d.language !== 'string') fail('language is missing')
  if (!Array.isArray(d.fields) || !d.fields.length) fail('fields are missing')
  if (!Array.isArray(d.templates) || !d.templates.length) fail('templates are missing')
  if (!Array.isArray(d.cards)) fail('cards are missing')
  for (const key of Object.keys(d))
    if (!KNOWN_DECK_KEYS.has(key) && !key.startsWith('x-')) warnings.push(`ignored property ${key}`)

  const deck = d as unknown as Deck
  const fields = new Map<string, Deck['fields'][number]>()
  for (const f of deck.fields) {
    if (!isObject(f) || typeof f.id !== 'string') fail('a field has no id')
    if (!['text', 'image', 'audio', 'video'].includes(f.type)) fail(`field ${f.id}: unknown type`)
    if (f.type === 'text' && typeof f.lang !== 'string') fail(`field ${f.id}: text needs a lang`)
    if (fields.has(f.id)) fail(`duplicate field ${f.id}`)
    fields.set(f.id, f)
  }
  const templateIds = new Set<string>()
  for (const t of deck.templates) {
    if (!isObject(t) || typeof t.id !== 'string') fail('a template has no id')
    if (templateIds.has(t.id)) fail(`duplicate template ${t.id}`)
    templateIds.add(t.id)
    if (!Array.isArray(t.prompt) || !t.prompt.length) fail(`template ${t.id}: no prompt`)
    for (const item of [...t.prompt, ...(t.reveal ?? [])])
      if (!fields.has(promptField(item))) fail(`template ${t.id}: unknown field`)
    const answer = fields.get(t.answer)
    if (!answer) fail(`template ${t.id}: unknown answer field`)
    if (answer!.type !== 'text' && answer!.type !== 'image')
      fail(`template ${t.id}: the answer must be text or a picture`)
    const methods = (t.methods ?? ['type', 'choose', 'flip']).filter(
      (m) => METHODS.includes(m) && !(answer!.type === 'image' && m === 'type'),
    )
    if (!methods.length) fail(`template ${t.id}: no usable answer method`)
    t.methods = methods
  }
  const cardIds = new Set<string>()
  for (const c of deck.cards) {
    if (!isObject(c) || typeof c.id !== 'string' || !c.id) fail('a card has no id')
    if (cardIds.has(c.id)) fail(`duplicate card ${c.id}`)
    cardIds.add(c.id)
    if (!isObject(c.fields)) fail(`card ${c.id}: no fields`)
    for (const [fid, v] of Object.entries(c.fields)) {
      const f = fields.get(fid)
      if (!f) {
        warnings.push(`card ${c.id}: ignored field ${fid}`)
        delete c.fields[fid]
        continue
      }
      if (f.type === 'text' && (!isObject(v) || typeof v.text !== 'string'))
        fail(`card ${c.id}: ${fid} should be text`)
      if (f.type !== 'text' && (!isObject(v) || typeof v.src !== 'string' || !isMediaPath(v.src)))
        fail(`card ${c.id}: ${fid} needs a src inside media/`)
      const audio = (v as { audio?: Record<string, string> }).audio
      if (audio)
        for (const [voice, src] of Object.entries(audio))
          if (!isMediaPath(src)) {
            warnings.push(`card ${c.id}: ignored audio ${voice}`)
            delete audio[voice]
          }
    }
  }
  for (const c of deck.cards)
    c.confusable = (c.confusable ?? []).filter((id) => id !== c.id && cardIds.has(id))
  if (deck.cover && !isMediaPath(deck.cover)) {
    warnings.push('ignored cover')
    delete deck.cover
  }
  return { deck, warnings }
}
