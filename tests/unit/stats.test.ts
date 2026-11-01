import { describe, expect, it } from 'vitest'
import { cardLevels, levelOf, misspellings, readiness, streak } from '../../src/lib/study/stats'
import { emptySave, type ReviewEntry } from '../../src/lib/storage/schema'
import { grade } from '../../src/lib/srs/scheduler'
import { DAY } from '../../src/lib/time'
import { testDeck } from '../fixtures/deck'

const NOW = new Date(2026, 10, 2, 16, 0).getTime()
const at = (t: number, extra: Partial<ReviewEntry> = {}): ReviewEntry => ({
  t,
  deck: 'deck-1',
  card: 'fork',
  template: 'picture-to-word',
  mode: 'learn',
  method: 'type',
  correct: true,
  hints: 0,
  ms: 1,
  ...extra,
})

describe('streak', () => {
  it('counts days in a row and forgives one day off', () => {
    expect(streak([], NOW)).toBe(0)
    expect(streak([at(NOW - 2 * DAY), at(NOW - DAY), at(NOW)], NOW)).toBe(3)
    // Nothing yet today: yesterday's streak still stands.
    expect(streak([at(NOW - 2 * DAY), at(NOW - DAY)], NOW)).toBe(2)
    // One day off in between doesn't break it.
    expect(streak([at(NOW - 3 * DAY), at(NOW - DAY), at(NOW)], NOW)).toBe(3)
    // Two days off do.
    expect(streak([at(NOW - 4 * DAY), at(NOW - DAY), at(NOW)], NOW)).toBe(2)
  })
})

describe('levels', () => {
  it('goes from new to mastered', () => {
    expect(levelOf(undefined)).toBe('new')
    expect(levelOf(grade(undefined, 3, NOW))).toBe('learning')
    expect(levelOf({ ...grade(undefined, 4, NOW), state: 2, stability: 5 })).toBe('known')
    expect(levelOf({ ...grade(undefined, 4, NOW), state: 2, stability: 30 })).toBe('mastered')
  })
  it('counts a card by its weakest template', () => {
    const deck = testDeck()
    const save = emptySave('p')
    const known = { ...grade(undefined, 4, NOW), state: 2 as const, stability: 5 }
    save.decks[deck.id] = {
      updatedAt: 0,
      items: {
        fork: { 'picture-to-word': known, 'dutch-to-english': known },
        knife: { 'picture-to-word': known },
      },
    }
    expect(cardLevels(deck, save)).toEqual({ new: 6, learning: 0, known: 1, mastered: 0 })
    expect(readiness(deck, save)).toEqual({ known: 1, total: 7 })
  })
})

describe('misspellings', () => {
  it('collects what was typed instead', () => {
    const deck = testDeck()
    const log = [
      at(1, { correct: false, answered: 'frok' }),
      at(2, { correct: false, answered: 'Frok' }),
      at(3, { correct: false, answered: 'fok' }),
    ]
    expect(misspellings(deck, log)[0].typed).toEqual([
      { text: 'frok', count: 2 },
      { text: 'fok', count: 1 },
    ])
  })
})
