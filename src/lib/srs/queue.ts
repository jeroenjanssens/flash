import { activeTemplates, applies, isPictureAnswer } from '../deck/items'
import type { Card, Deck, Method, Template } from '../deck/types'
import type { AnswerStyle, DeckProgress, ItemRecord, ProfileSave } from '../storage/schema'
import { HOUR, MINUTE, dayKey } from '../time'
import { retrievability } from './scheduler'

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

/** On the first day, a new card is asked with at most this many templates. */
export const FIRST_DAY_TEMPLATES = 2
/** Questions about other cards between two questions about the same card, where possible. */
export const SIBLING_GAP = 4

const cardKey = (item: { deck: Deck; card: Card }) => `${item.deck.id}/${item.card.id}`

/** Another due review of the same card waits at least this long (morning, then evening). */
export const BURY_HOURS = 4
/** "One more round" doesn't ask a card that was asked less than this long ago. */
export const EXTRA_MIN_HOURS = 1

/** Modes that change the schedule. */
const scheduled = (mode: string) => mode === 'learn' || mode === 'extra'

/** When each card was last asked in Learn, and which cards started a new template today. */
function history(save: ProfileSave, deckId: string, now: number) {
  const day = dayKey(now)
  const before = new Set<string>()
  const lastAsked = new Map<string, number>()
  for (const e of save.log) {
    if (e.deck !== deckId || !scheduled(e.mode)) continue
    if (dayKey(e.t) !== day) before.add(`${e.card}/${e.template}`)
    lastAsked.set(e.card, Math.max(lastAsked.get(e.card) ?? 0, e.t))
  }
  const started = new Set<string>()
  for (const e of save.log)
    if (
      e.deck === deckId &&
      scheduled(e.mode) &&
      dayKey(e.t) === day &&
      !before.has(`${e.card}/${e.template}`)
    )
      started.add(e.card)
  return {
    /** How long ago the card was last asked (Infinity: never). */
    since: (card: string) => now - (lastAsked.get(card) ?? -Infinity),
    /** A template of the card was asked for the first time today. */
    started: (card: string) => started.has(card),
  }
}

interface Selection {
  /** Questions about cards that were studied before, with when they were due. */
  due: { item: SessionItem; due: number }[]
  /** New cards (up to today's limit), each with the templates for its first day. */
  fresh: SessionItem[][]
  /** Cards that were never studied. */
  unseen: number
}

/**
 * What to study in a deck now. Questions about the same card are spread out over days, because
 * answering a card one way right after another way tests nothing (the answer was just shown)
 * and would make the scheduler think it's known better than it is:
 * - a new card starts with its first `FIRST_DAY_TEMPLATES` templates;
 * - a card's learning steps (after a first or a wrong answer) are always asked;
 * - of a card's reviews that are due, only one is asked (the most overdue); the others wait at
 *   least `BURY_HOURS` after the card was asked ("burying siblings", as in Anki, but per half
 *   day, so a morning and an evening session both work);
 * - a template that was switched on later starts for one card at most once per day.
 */
function select(deck: Deck, save: ProfileSave, now: number, newBonus = 0): Selection {
  const progress = save.decks[deck.id]
  const templates = activeTemplates(deck, progress?.templates)
  const asked = history(save, deck.id, now)
  let newLeft = Math.max(0, save.settings.newPerDay + newBonus - newCardsToday(save, deck.id, now))
  const out: Selection = { due: [], fresh: [], unseen: 0 }
  for (const card of deck.cards) {
    const usable = templates.filter((t) => applies(t, card))
    if (!usable.length) continue
    if (isNewCard(progress, card)) {
      out.unseen++
      if (newLeft-- > 0)
        out.fresh.push(
          usable
            .slice(0, FIRST_DAY_TEMPLATES)
            .map((template, i) => ({ deck, card, template, intro: i === 0 })),
        )
      continue
    }
    let review: { item: SessionItem; due: number } | undefined
    let start: SessionItem | undefined
    for (const template of usable) {
      const r = recordOf(progress, card.id, template.id)
      const item = { deck, card, template }
      if (!r || r.state === 0) start ??= item
      else if (r.due > now) continue
      else if (r.state === 1 || r.state === 3) out.due.push({ item, due: r.due })
      else if (!review || r.due < review.due) review = { item, due: r.due }
    }
    if (review && asked.since(card.id) >= BURY_HOURS * HOUR) out.due.push(review)
    // A template that was never asked comes after the reviews.
    if (start && !asked.started(card.id)) out.due.push({ item: start, due: now })
  }
  return out
}

export interface DeckCounts {
  due: number
  /** New cards that can still be introduced today. */
  newCards: number
  /** Cards that were never studied. */
  unseen: number
}

export function deckCounts(deck: Deck, save: ProfileSave, now: number): DeckCounts {
  const { due, fresh, unseen } = select(deck, save, now)
  return { due: due.length, newCards: fresh.length, unseen }
}

/**
 * Reorder questions so that two questions about the same card are at least `gap` questions
 * apart where possible, keeping the order otherwise (the first question that may go next goes).
 */
export function spread(items: SessionItem[], gap = SIBLING_GAP): SessionItem[] {
  const pending = [...items]
  const out: SessionItem[] = []
  while (pending.length) {
    const recent = new Set(out.slice(-gap).map(cardKey))
    let i = pending.findIndex((item) => !recent.has(cardKey(item)))
    // Nothing fits (only one card left, say): take the one whose card was asked longest ago.
    if (i < 0) {
      const last = (item: SessionItem) => out.map(cardKey).lastIndexOf(cardKey(item))
      i = pending.reduce((best, item, j) => (last(item) < last(pending[best]) ? j : best), 0)
    }
    out.push(...pending.splice(i, 1))
  }
  return out
}

export interface QueueOptions {
  /** New cards on top of today's limit ("+5 new words"). */
  newBonus?: number
  /**
   * "One more round": after what's due, fill up with the cards that are most likely forgotten
   * by now (lowest retrievability), one template per card, even if they aren't due yet. Their
   * answers count with the real time since the last review, so FSRS handles them correctly.
   */
  extra?: boolean
}

/**
 * The questions for a Learn session: due questions first (most overdue first), then new cards
 * in deck order (each introduced, then asked with its first-day templates), and for an extra
 * round the weakest cards, spread out so the same card isn't asked twice close together, up to
 * `size`.
 */
export function buildQueue(
  decks: Deck[],
  save: ProfileSave,
  now: number,
  size: number,
  options: QueueOptions = {},
): SessionItem[] {
  const due: { item: SessionItem; due: number }[] = []
  const fresh: SessionItem[][] = []
  for (const deck of decks) {
    const s = select(deck, save, now, options.newBonus)
    due.push(...s.due)
    fresh.push(...s.fresh)
  }
  due.sort((a, b) => a.due - b.due)
  const queue = due.map((d) => d.item)
  // New cards: first every new card's first template, then the second templates.
  const rounds = Math.max(0, ...fresh.map((f) => f.length))
  for (let r = 0; r < rounds; r++) for (const f of fresh) if (f[r]) queue.push(f[r])
  if (options.extra && queue.length < size) {
    const taken = new Set(queue.map(cardKey))
    queue.push(...weakest(decks, save, now, taken).slice(0, size - queue.length))
  }
  return spread(queue).slice(0, size)
}

/** The weakest template of every studied card (not asked in the last hour), weakest first. */
export function weakest(
  decks: Deck[],
  save: ProfileSave,
  now: number,
  skip = new Set<string>(),
): SessionItem[] {
  const out: { item: SessionItem; r: number }[] = []
  for (const deck of decks) {
    const progress = save.decks[deck.id]
    const templates = activeTemplates(deck, progress?.templates)
    const asked = history(save, deck.id, now)
    for (const card of deck.cards) {
      if (skip.has(`${deck.id}/${card.id}`) || asked.since(card.id) < EXTRA_MIN_HOURS * HOUR)
        continue
      let best: { item: SessionItem; r: number } | undefined
      for (const template of templates) {
        if (!applies(template, card)) continue
        const record = recordOf(progress, card.id, template.id)
        if (!record || record.state !== 2) continue
        const r = retrievability(record, now) ?? 1
        if (!best || r < best.r) best = { item: { deck, card, template }, r }
      }
      if (best) out.push(best)
    }
  }
  return out.sort((a, b) => a.r - b.r).map((x) => x.item)
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
const sessionKey = (item: SessionItem) => `${item.deck.id}/${item.card.id}/${item.template.id}`

export class Session {
  readonly queue: SessionItem[]
  private repeats = new Map<string, number>()
  /** Questions that are finished for this session (they won't come back). */
  private finished = new Set<string>()
  /** The different questions in the session. */
  readonly total: number
  done = 0
  constructor(items: SessionItem[]) {
    this.queue = [...items]
    this.total = new Set(items.map(sessionKey)).size
  }
  get current(): SessionItem | undefined {
    return this.queue[0]
  }
  /** The state of the session, to go back to (undo). */
  snapshot() {
    return {
      queue: [...this.queue],
      repeats: new Map(this.repeats),
      finished: new Set(this.finished),
      done: this.done,
    }
  }
  restore(snap: ReturnType<Session['snapshot']>): void {
    this.queue.splice(0, this.queue.length, ...snap.queue)
    this.repeats = new Map(snap.repeats)
    this.finished = new Set(snap.finished)
    this.done = snap.done
  }
  /** Answers still to give, repeats included. */
  get left(): number {
    return this.queue.length
  }
  /** Different questions that aren't finished yet: what a learner sees as "left". */
  get remaining(): number {
    return this.total - this.finished.size
  }
  /**
   * 0–1, moving on every answer: a finished question counts fully, one that was answered and
   * comes back counts half.
   */
  get progress(): number {
    if (!this.total) return 1
    const started = new Set([...this.repeats.keys()].filter((k) => !this.finished.has(k))).size
    return (this.finished.size + started * 0.5) / this.total
  }
  /**
   * Where to put a question that comes back: `gap` questions on, or later if that would put it
   * close to another question about the same card.
   */
  private slot(item: SessionItem, gap: number): number {
    const key = cardKey(item)
    const near = (i: number) =>
      this.queue.slice(Math.max(0, i - 2), i + 2).some((q) => cardKey(q) === key)
    for (let i = Math.min(gap, this.queue.length); i <= this.queue.length; i++)
      if (!near(i)) return i
    return this.queue.length
  }
  /** Move on after answering the current item. */
  next(record: ItemRecord | undefined, now: number): void {
    const item = this.queue.shift()
    if (!item) return
    this.done++
    const key = sessionKey(item)
    const count = this.repeats.get(key) ?? 0
    if (record && record.due - now < 20 * MINUTE && count < 3) {
      this.repeats.set(key, count + 1)
      const gap = record.due - now < 2 * MINUTE ? 3 : 6
      this.queue.splice(this.slot(item, gap), 0, { ...item, intro: false })
    } else if (!this.queue.some((q) => sessionKey(q) === key)) {
      this.finished.add(key)
    }
  }
}
