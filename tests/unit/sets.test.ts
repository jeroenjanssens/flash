import { describe, expect, it } from 'vitest'
import { grade } from '../../src/lib/srs/scheduler'
import { emptySave } from '../../src/lib/storage/schema'
import {
  cardsInSet,
  defaultSet,
  isFixedSet,
  seenCards,
  type CardSet,
} from '../../src/lib/study/sets'
import { DAY } from '../../src/lib/time'
import { testDeck } from '../fixtures/deck'

const NOW = new Date(2026, 10, 3, 16, 0).getTime()

describe('card sets', () => {
  const deck = testDeck()
  const tpl = deck.templates[0]
  const ids = (cards: { id: string }[]) => cards.map((c) => c.id)

  function save() {
    const s = emptySave('p')
    const mastered = { ...grade(undefined, 4, NOW - 60 * DAY), state: 2 as const, stability: 90 }
    s.decks[deck.id] = {
      updatedAt: 0,
      items: {
        // Learning in one direction, never asked in the other.
        fork: { [tpl.id]: grade(undefined, 3, NOW) },
        // Mastered in every direction.
        knife: Object.fromEntries(deck.templates.map((t) => [t.id, mastered])),
        // A record that was never answered doesn't count as seen.
        spoon: { [tpl.id]: { ...grade(undefined, 3, NOW), state: 0 as const } },
      },
    }
    // Seen only in practice.
    s.log.push({
      t: NOW,
      deck: deck.id,
      card: 'cup',
      template: tpl.id,
      mode: 'choose',
      method: 'choose',
      correct: true,
      hints: 0,
      ms: 1,
    })
    return s
  }

  it('seen so far: answered at least once, in any direction or mode', () => {
    expect([...seenCards(deck, save())].sort()).toEqual(['cup', 'fork', 'knife'])
    expect(ids(cardsInSet(deck, tpl, 'seen', save()))).toEqual(
      ids(deck.cards.filter((c) => ['fork', 'knife', 'cup'].includes(c.id))),
    )
  })

  it('still learning leaves out cards that were never seen, and mastered ones', () => {
    const learning = ids(cardsInSet(deck, tpl, 'learning', save()))
    expect(learning).toContain('fork')
    expect(learning).toContain('cup')
    expect(learning).not.toContain('knife')
    expect(learning).not.toContain('spoon')
  })

  it('starts with seen so far once there are enough cards', () => {
    expect(defaultSet(deck, emptySave('p'))).toBe('all')
    expect(defaultSet(deck, save(), 3)).toBe('seen')
    expect(defaultSet(deck, save(), 4)).toBe('all')
  })

  it('keeps records only for sets that stay the same', () => {
    const sets: CardSet[] = ['all', 'tag:kitchen', 'seen', 'learning', 'list']
    expect(sets.map(isFixedSet)).toEqual([true, true, false, false, false])
  })
})
