import { activeTemplates, applies, mainTextField, textOf } from '../deck/items'
import type { Card, Deck, Template } from '../deck/types'
import type {
  DeckProgress,
  ItemRecord,
  ProfileSave,
  RaceRecord,
  ReviewEntry,
  SprintRecord,
} from '../storage/schema'
import { DAY, addDays, dayKey, startOfDay } from '../time'

export type Level = 'new' | 'learning' | 'known' | 'mastered'
export const LEVELS: readonly Level[] = ['new', 'learning', 'known', 'mastered']
const RANK: Record<Level, number> = { new: 0, learning: 1, known: 2, mastered: 3 }

/** Mastered: remembered for three weeks or more. */
export const MASTERED_DAYS = 21

export function levelOf(record: ItemRecord | undefined): Level {
  if (!record || record.state === 0) return 'new'
  if (record.state === 1 || record.state === 3) return 'learning'
  return record.stability >= MASTERED_DAYS ? 'mastered' : 'known'
}

/** A card's level: the lowest of its active templates. */
export function cardLevel(card: Card, templates: Template[], progress?: DeckProgress): Level {
  const usable = templates.filter((t) => applies(t, card))
  if (!usable.length) return 'new'
  let min: Level = 'mastered'
  for (const t of usable) {
    const l = levelOf(progress?.items[card.id]?.[t.id])
    if (RANK[l] < RANK[min]) min = l
  }
  return min
}

export type LevelCounts = Record<Level, number>

const emptyCounts = (): LevelCounts => ({ new: 0, learning: 0, known: 0, mastered: 0 })

/** Per template: how many cards are at each level. */
export function templateLevels(
  deck: Deck,
  template: Template,
  progress?: DeckProgress,
): LevelCounts {
  const counts = emptyCounts()
  for (const card of deck.cards)
    if (applies(template, card)) counts[levelOf(progress?.items[card.id]?.[template.id])]++
  return counts
}

export function cardLevels(deck: Deck, save: ProfileSave): LevelCounts {
  const progress = save.decks[deck.id]
  const templates = activeTemplates(deck, progress?.templates)
  const counts = emptyCounts()
  for (const card of deck.cards) if (!card.suspended) counts[cardLevel(card, templates, progress)]++
  return counts
}

/** 0–1: how far along a deck is (known counts for two thirds, mastered for all). */
export function deckProgress(counts: LevelCounts): number {
  const total = counts.new + counts.learning + counts.known + counts.mastered
  if (!total) return 0
  return (counts.learning * 0.25 + counts.known * 0.67 + counts.mastered) / total
}

export function activityByDay(log: ReviewEntry[]): Map<string, number> {
  const days = new Map<string, number>()
  for (const e of log) {
    const d = dayKey(e.t)
    days.set(d, (days.get(d) ?? 0) + 1)
  }
  return days
}

export function answersToday(log: ReviewEntry[], now: number): number {
  const today = dayKey(now)
  let n = 0
  for (let i = log.length - 1; i >= 0 && dayKey(log[i].t) === today; i--) n++
  return n
}

/**
 * Days in a row with practice. Kind on purpose: a single day off doesn't break the streak (it
 * just doesn't count), and today only breaks it at the end of the day.
 */
export function streak(log: ReviewEntry[], now: number): number {
  const days = activityByDay(log)
  let day = dayKey(now)
  if (!days.has(day)) day = addDays(day, -1)
  let count = 0
  let gap = 0
  for (let i = 0; i < 3660; i++) {
    if (days.has(day)) {
      count++
      gap = 0
    } else if (++gap > 1) break
    day = addDays(day, -1)
  }
  return count
}

/** How many items are due on each of the next `days` days (anything overdue counts for today). */
export function forecast(deck: Deck, save: ProfileSave, now: number, days = 14): number[] {
  const progress = save.decks[deck.id]
  const templates = activeTemplates(deck, progress?.templates)
  const out = Array.from({ length: days }, () => 0)
  const today = startOfDay(dayKey(now))
  for (const card of deck.cards)
    for (const t of templates) {
      const r = progress?.items[card.id]?.[t.id]
      if (!r || r.state === 0 || !applies(t, card)) continue
      const i = Math.max(0, Math.floor((startOfDay(dayKey(r.due)) - today) / DAY))
      if (i < days) out[i]++
    }
  return out
}

/** Cards that are known (or mastered) in every active template: "ready for the test". */
export function readiness(deck: Deck, save: ProfileSave): { known: number; total: number } {
  const counts = cardLevels(deck, save)
  const total = counts.new + counts.learning + counts.known + counts.mastered
  return { known: counts.known + counts.mastered, total }
}

export interface Trouble {
  card: Card
  wrong: number
  right: number
}

/** The cards answered wrong most often (at least once). */
export function hardest(deck: Deck, log: ReviewEntry[], n = 8): Trouble[] {
  const byCard = new Map<string, { wrong: number; right: number }>()
  for (const e of log) {
    if (e.deck !== deck.id || e.intro) continue
    const s = byCard.get(e.card) ?? { wrong: 0, right: 0 }
    if (e.correct) s.right++
    else s.wrong++
    byCard.set(e.card, s)
  }
  return deck.cards
    .map((card) => ({ card, ...(byCard.get(card.id) ?? { wrong: 0, right: 0 }) }))
    .filter((t) => t.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong || a.right - b.right)
    .slice(0, n)
}

export interface Misspelling {
  card: Card
  expected: string
  typed: { text: string; count: number }[]
}

/** What was typed instead of the right word, per card, most frequent first. */
export function misspellings(deck: Deck, log: ReviewEntry[], n = 10): Misspelling[] {
  const byCard = new Map<string, Map<string, number>>()
  for (const e of log) {
    if (e.deck !== deck.id || e.method !== 'type' || !e.answered) continue
    const m = byCard.get(e.card) ?? new Map<string, number>()
    const text = e.answered.trim().toLowerCase()
    m.set(text, (m.get(text) ?? 0) + 1)
    byCard.set(e.card, m)
  }
  const out: Misspelling[] = []
  for (const card of deck.cards) {
    const m = byCard.get(card.id)
    if (!m) continue
    const template = deck.templates.find((t) => t.methods?.includes('type'))
    const field = template?.answer ?? mainTextField(deck) ?? ''
    const typed = [...m.entries()]
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
    out.push({ card, expected: textOf(card, field)?.text ?? '', typed })
  }
  return out
    .sort(
      (a, b) => b.typed.reduce((s, t) => s + t.count, 0) - a.typed.reduce((s, t) => s + t.count, 0),
    )
    .slice(0, n)
}

export function bestSprint(
  sprints: SprintRecord[],
  match: Pick<SprintRecord, 'deck' | 'template' | 'method' | 'minutes'> & { set: string },
): SprintRecord | undefined {
  let best: SprintRecord | undefined
  for (const s of sprints)
    if (
      s.deck === match.deck &&
      (s.set ?? 'all') === match.set &&
      s.template === match.template &&
      s.method === match.method &&
      s.minutes === match.minutes &&
      (!best || s.score > best.score)
    )
      best = s
  return best
}

export function bestRace(
  races: RaceRecord[],
  match: Pick<RaceRecord, 'deck' | 'set' | 'template' | 'method'>,
): RaceRecord | undefined {
  let best: RaceRecord | undefined
  for (const r of races)
    if (
      r.deck === match.deck &&
      r.set === match.set &&
      r.template === match.template &&
      r.method === match.method &&
      (!best || r.ms < best.ms)
    )
      best = r
  return best
}
