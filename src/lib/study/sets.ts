import { activeTemplates, applies, deckTags } from '../deck/items'
import type { Card, Deck, Template } from '../deck/types'
import type { ProfileSave } from '../storage/schema'
import { cardLevel } from './stats'

/**
 * Which cards to practise: all, the ones seen so far, the ones seen but not mastered yet, a tag,
 * or a given list.
 */
export type CardSet = 'all' | 'seen' | 'learning' | `tag:${string}` | 'list'

export function setOptions(deck: Deck): CardSet[] {
  return ['all', 'seen', 'learning', ...deckTags(deck).map((t) => `tag:${t}` as const)]
}

/** Sets whose cards don't change as you learn: only those keep best scores. */
export const isFixedSet = (set: CardSet): boolean => set === 'all' || set.startsWith('tag:')

/** Cards that were answered at least once, in any direction and any mode. */
export function seenCards(deck: Deck, save: ProfileSave): Set<string> {
  const seen = new Set<string>()
  for (const [card, items] of Object.entries(save.decks[deck.id]?.items ?? {}))
    if (Object.values(items).some((r) => r.state !== 0)) seen.add(card)
  for (const e of save.log) if (e.deck === deck.id) seen.add(e.card)
  return seen
}

/** "Seen so far" when that's enough cards to practise with, else all of them. */
export function defaultSet(deck: Deck, save: ProfileSave, min = 4): CardSet {
  return seenCards(deck, save).size >= min ? 'seen' : 'all'
}

export function cardsInSet(
  deck: Deck,
  template: Template,
  set: CardSet,
  save: ProfileSave,
  list: string[] = [],
): Card[] {
  const progress = save.decks[deck.id]
  const templates = activeTemplates(deck, progress?.templates)
  const seen = set === 'seen' || set === 'learning' ? seenCards(deck, save) : undefined
  return deck.cards.filter((card) => {
    if (!applies(template, card)) return false
    if (set === 'all') return true
    if (set === 'list') return list.includes(card.id)
    if (set === 'seen') return seen!.has(card.id)
    if (set === 'learning')
      return seen!.has(card.id) && cardLevel(card, templates, progress) !== 'mastered'
    return (card.tags ?? []).includes(set.slice(4))
  })
}
