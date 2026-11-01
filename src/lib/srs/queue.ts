import { activeTemplates, applies, isPictureAnswer } from '../deck/items'
import type { Card, Deck, Method, Template } from '../deck/types'
import type { AnswerStyle, DeckProgress, ItemRecord, ProfileSave } from '../storage/schema'
import { MINUTE, dayKey } from '../time'

/** A question in a session: a card, asked with a template, from a deck. */
export interface SessionItem {
  deck: Deck
  card: Card
  template: Template
  /** First time this card is seen: introduce it before asking. */
  intro?: boolean
}

export function recordOf(
  progress: DeckProgress | undefined,
  cardId: string,
  templateId: string,
): ItemRecord | undefined {
  return progress?.items[cardId]?.[templateId]
}

/** A card is new when none of its templates has been reviewed. */
export function isNewCard(progress: DeckProgress | undefined, card: Card): boolean {
  const items = progress?.items[card.id]
  return !items || Object.values(items).every((r) => r.state === 0)
}

/** The number of new cards introduced in a deck today. */
export function newCardsToday(save: ProfileSave, deckId: string, now: number): number {
  const today = dayKey(now)
  const cards = new Set<string>()
  for (let i = save.log.length - 1; i >= 0; i--) {
    const e = save.log[i]
    if (dayKey(e.t) !== today) break
    if (e.deck === deckId && e.intro) cards.add(e.card)
  }
  return cards.size
}

export interface DeckCounts {
  due: number
  /** New cards that can still be introduced today. */
  newCards: number
  /** Cards that were never studied. */
  unseen: number
}

export function deckCounts(deck: Deck, save: ProfileSave, now: number): DeckCounts {
  const progress = save.decks[deck.id]
  const templates = activeTemplates(deck, progress?.templates)
  let due = 0
  let unseen = 0
  for (const card of deck.cards) {
    if (card.suspended) continue
    if (isNewCard(progress, card)) {
      if (templates.some((t) => applies(t, card))) unseen++
      continue
    }
    for (const t of templates) {
      if (!applies(t, card)) continue
      const r = recordOf(progress, card.id, t.id)
      // A template switched on later counts as due, so the card gets asked that way too.
      if (!r || r.state === 0 || r.due <= now) due++
    }
  }
  const left = Math.max(0, save.settings.newPerDay - newCardsToday(save, deck.id, now))
  return { due, newCards: Math.min(left, unseen), unseen }
}

/**
 * The questions for a Learn session: due items first (most overdue first), then new cards in
 * deck order (each introduced once, then asked with every active template), up to `size`.
 */
export function buildQueue(
  decks: Deck[],
  save: ProfileSave,
  now: number,
  size: number,
): SessionItem[] {
  const due: { item: SessionItem; due: number }[] = []
  const fresh: SessionItem[][] = []
  for (const deck of decks) {
    const progress = save.decks[deck.id]
    const templates = activeTemplates(deck, progress?.templates)
    let newLeft = Math.max(0, save.settings.newPerDay - newCardsToday(save, deck.id, now))
    for (const card of deck.cards) {
      const usable = templates.filter((t) => applies(t, card))
      if (!usable.length) continue
      if (isNewCard(progress, card)) {
        if (newLeft-- > 0)
          fresh.push(usable.map((template, i) => ({ deck, card, template, intro: i === 0 })))
        continue
      }
      for (const template of usable) {
        const r = recordOf(progress, card.id, template.id)
        if (!r || r.state === 0) due.push({ item: { deck, card, template }, due: 0 })
        else if (r.due <= now) due.push({ item: { deck, card, template }, due: r.due })
      }
    }
  }
  due.sort((a, b) => a.due - b.due)
  const queue = due.map((d) => d.item)
  // New cards: first every new card's first template, then the second templates, … so the same
  // card isn't asked twice in a row.
  const rounds = Math.max(0, ...fresh.map((f) => f.length))
  for (let r = 0; r < rounds; r++) for (const f of fresh) if (f[r]) queue.push(f[r])
  return queue.slice(0, size)
}

/** How the answer is given in Learn, for a learner's answer style. */
export function learnMethod(style: AnswerStyle, item: SessionItem, record?: ItemRecord): Method {
  const methods = item.template.methods ?? ['type', 'choose', 'flip']
  if (isPictureAnswer(item.deck, item.template))
    return methods.includes('choose') ? 'choose' : 'flip'
  if (style !== 'auto' && methods.includes(style)) return style
  if (methods.includes('type') && methods.includes('choose')) return record?.stage ?? 'choose'
  return methods.find((m) => m !== 'flip') ?? methods[0]
}

/** The stage after an answer: a right choice moves on to typing, a wrong typed answer goes back. */
export function nextStage(
  method: Method,
  correct: boolean,
  stage: ItemRecord['stage'],
): ItemRecord['stage'] {
  if (method === 'choose' && correct) return 'type'
  if (method === 'type' && !correct) return 'choose'
  return stage
}

/**
 * The questions of a running session. An item that's due again soon (a learning step, after a
 * wrong answer) comes back a few questions later, at most three extra times.
 */
export class Session {
  readonly queue: SessionItem[]
  private repeats = new Map<string, number>()
  done = 0
  constructor(items: SessionItem[]) {
    this.queue = [...items]
  }
  get current(): SessionItem | undefined {
    return this.queue[0]
  }
  /** The state of the session, to go back to (undo). */
  snapshot(): { queue: SessionItem[]; repeats: Map<string, number>; done: number } {
    return { queue: [...this.queue], repeats: new Map(this.repeats), done: this.done }
  }
  restore(snap: ReturnType<Session['snapshot']>): void {
    this.queue.splice(0, this.queue.length, ...snap.queue)
    this.repeats = new Map(snap.repeats)
    this.done = snap.done
  }
  get left(): number {
    return this.queue.length
  }
  /** Move on after answering the current item. */
  next(record: ItemRecord | undefined, now: number): void {
    const item = this.queue.shift()
    if (!item) return
    this.done++
    const key = `${item.deck.id}/${item.card.id}/${item.template.id}`
    const count = this.repeats.get(key) ?? 0
    if (record && record.due - now < 20 * MINUTE && count < 3) {
      this.repeats.set(key, count + 1)
      const gap = record.due - now < 2 * MINUTE ? 3 : 6
      this.queue.splice(Math.min(gap, this.queue.length), 0, { ...item, intro: false })
    }
  }
}
