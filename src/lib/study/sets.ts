import { activeTemplates, applies, deckTags } from '../deck/items'
import type { Card, Deck, Template } from '../deck/types'
import type { ProfileSave } from '../storage/schema'
import { cardLevel } from './stats'

/** Which cards to practise: all, a tag, the ones still being learned, or a given list. */
export type CardSet = 'all' | 'learning' | `tag:${string}` | 'list'

export function setOptions(deck: Deck): CardSet[] {
  return ['all', 'learning', ...deckTags(deck).map((t) => `tag:${t}` as const)]
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
  return deck.cards.filter((card) => {
    if (!applies(template, card)) return false
    if (set === 'all') return true
    if (set === 'list') return list.includes(card.id)
    if (set === 'learning') return cardLevel(card, templates, progress) !== 'mastered'
    return (card.tags ?? []).includes(set.slice(4))
  })
}
