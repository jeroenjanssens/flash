import { describe, expect, it } from 'vitest'
import { DeckError, parseDeck } from '../../src/lib/deck/parse'
import { activeTemplates, applies, itemsFor } from '../../src/lib/deck/items'
import { testDeck } from '../fixtures/deck'

describe('parseDeck', () => {
  it('accepts a valid deck and ignores unknown properties', () => {
    const raw = { ...testDeck(), future: true, 'x-note': 1 }
    const { deck, warnings } = parseDeck(raw)
    expect(deck.cards).toHaveLength(7)
    expect(warnings).toEqual(['ignored property future'])
  })
  it('rejects decks from a newer format', () => {
    expect(() => parseDeck({ ...testDeck(), formatVersion: 2 })).toThrow(DeckError)
  })
  it('rejects broken templates and media outside media/', () => {
    const d = testDeck()
    d.templates[0].answer = 'nope'
    expect(() => parseDeck(d)).toThrow(/unknown answer/)
    const e = testDeck()
    e.cards[0].fields.image = { src: '../secret.png' }
    expect(() => parseDeck(e)).toThrow(/media/)
  })
  it('never allows typing a picture', () => {
    const d = testDeck()
    d.templates[2].methods = ['type', 'choose']
    expect(parseDeck(d).deck.templates[2].methods).toEqual(['choose'])
  })
  it('drops confusable links to unknown cards', () => {
    const d = testDeck()
    d.cards[0].confusable = ['knife', 'ghost']
    expect(parseDeck(d).deck.cards[0].confusable).toEqual(['knife'])
  })
})

describe('items', () => {
  it('uses the default templates unless chosen', () => {
    const deck = testDeck()
    expect(activeTemplates(deck).map((t) => t.id)).toEqual(['picture-to-word', 'dutch-to-english'])
    expect(activeTemplates(deck, ['listen-to-picture']).map((t) => t.id)).toEqual([
      'listen-to-picture',
    ])
  })
  it('skips cards that miss a field', () => {
    const deck = testDeck()
    delete deck.cards[0].fields.translation
    expect(applies(deck.templates[1], deck.cards[0])).toBe(false)
    expect(itemsFor(deck, activeTemplates(deck))).toHaveLength(13)
  })
})
