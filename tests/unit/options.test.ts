import { describe, expect, it } from 'vitest'
import { chooseOptions } from '../../src/lib/study/options'
import { testDeck } from '../fixtures/deck'

describe('chooseOptions', () => {
  const deck = testDeck()
  const tpl = deck.templates[0]
  it('gives four different options including the right one', () => {
    for (let i = 0; i < 20; i++) {
      const options = chooseOptions(deck, deck.cards[0], tpl)
      expect(options).toHaveLength(4)
      expect(options).toContain(deck.cards[0])
      expect(new Set(options.map((o) => o.id)).size).toBe(4)
    }
  })
  it('prefers confusable cards', () => {
    const options = chooseOptions(deck, deck.cards[0], tpl, 3, () => 0.5)
    expect(options.map((o) => o.id).sort()).toEqual(['fork', 'knife', 'spoon'])
  })
  it('gives fewer options for tiny decks', () => {
    const small = { ...deck, cards: deck.cards.slice(0, 2) }
    expect(chooseOptions(small, small.cards[0], tpl)).toHaveLength(2)
  })
})
