import { answerKey } from '../deck/items'
import type { Card, Deck, Template } from '../deck/types'

export type Random = () => number

export function shuffle<T>(items: readonly T[], random: Random = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * The options for a multiple-choice question: the right card and up to `count - 1` others with
 * a different answer. Cards marked as confusable come first, then cards with a shared tag, then
 * the rest, with some randomness so the same options don't always appear together.
 * `extra` can add cards from other decks (e.g. the same collection) when a deck is small.
 */
export function chooseOptions(
  deck: Deck,
  card: Card,
  template: Template,
  count = 4,
  random: Random = Math.random,
  extra: Card[] = [],
): Card[] {
  const key = answerKey(card, template.answer)
  const seen = new Set([key])
  const tags = new Set(card.tags ?? [])
  const confusable = new Set(card.confusable ?? [])
  const scored: { card: Card; score: number }[] = []
  for (const other of [...deck.cards, ...extra]) {
    if (other.id === card.id || other.suspended) continue
    const k = answerKey(other, template.answer)
    if (k === undefined || seen.has(k)) continue
    seen.add(k)
    let score = random()
    if (confusable.has(other.id)) score += 2
    if ((other.tags ?? []).some((t) => tags.has(t))) score += 0.7
    if (!deck.cards.includes(other)) score -= 1
    scored.push({ card: other, score })
  }
  scored.sort((a, b) => b.score - a.score)
  const wrong = scored.slice(0, count - 1).map((s) => s.card)
  return shuffle([card, ...wrong], random)
}
