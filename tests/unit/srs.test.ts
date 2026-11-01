import { describe, expect, it } from 'vitest'
import { capForTest, grade, retentionFor } from '../../src/lib/srs/scheduler'
import { Session, buildQueue, deckCounts, learnMethod, nextStage } from '../../src/lib/srs/queue'
import { emptySave } from '../../src/lib/storage/schema'
import { DAY, startOfDay } from '../../src/lib/time'
import { testDeck } from '../fixtures/deck'

const NOW = new Date(2026, 10, 2, 16, 0).getTime() // Monday 2 November, 16:00

describe('scheduler', () => {
  it('schedules a good answer on a new card a few minutes ahead', () => {
    const r = grade(undefined, 3, NOW)
    expect(r.state).toBe(1)
    expect(r.due - NOW).toBeLessThan(15 * 60_000)
  })
  it('aims higher in the week before a test', () => {
    expect(retentionFor(NOW, '2026-11-06')).toBe(0.95)
    expect(retentionFor(NOW, '2026-12-06')).toBe(0.9)
    expect(retentionFor(NOW)).toBe(0.9)
  })
  it('brings cards back on the day before a test', () => {
    const dayBefore = startOfDay('2026-11-05')
    expect(capForTest(NOW + 10 * DAY, NOW, '2026-11-06')).toBe(dayBefore + 6 * 3_600_000)
    expect(capForTest(NOW + DAY / 2, NOW, '2026-11-06')).toBe(NOW + DAY / 2)
    // After the test: normal intervals.
    expect(capForTest(NOW + 10 * DAY, NOW, '2026-10-30')).toBe(NOW + 10 * DAY)
  })
  it('keeps the learn stage', () => {
    const r = grade({ ...grade(undefined, 3, NOW), stage: 'type' }, 3, NOW + 60_000)
    expect(r.stage).toBe('type')
  })
})

describe('queue', () => {
  const deck = testDeck()
  it('introduces new cards up to the daily limit', () => {
    const save = emptySave('p')
    save.settings.newPerDay = 3
    const q = buildQueue([deck], save, NOW, 50)
    // 3 cards × 2 templates, first templates first.
    expect(q.map((i) => `${i.card.id}:${i.template.id}`)).toEqual([
      'fork:picture-to-word',
      'knife:picture-to-word',
      'spoon:picture-to-word',
      'fork:dutch-to-english',
      'knife:dutch-to-english',
      'spoon:dutch-to-english',
    ])
    expect(q.filter((i) => i.intro)).toHaveLength(3)
    expect(deckCounts(deck, save, NOW)).toEqual({ due: 0, newCards: 3, unseen: 7 })
  })
  it('puts due items first', () => {
    const save = emptySave('p')
    save.decks[deck.id] = {
      updatedAt: 0,
      items: { cup: { 'picture-to-word': { ...grade(undefined, 3, NOW - DAY), due: NOW - 1000 } } },
    }
    const q = buildQueue([deck], save, NOW, 50)
    expect(q[0].card.id).toBe('cup')
    expect(q[0].intro).toBeFalsy()
    // Its other template wasn't reviewed yet, so it's due too.
    expect(q.some((i) => i.card.id === 'cup' && i.template.id === 'dutch-to-english')).toBe(true)
  })
  it('repeats an item that is due again soon', () => {
    const save = emptySave('p')
    const q = buildQueue([deck], save, NOW, 4)
    const s = new Session(q)
    const first = s.current!
    s.next(grade(undefined, 1, NOW), NOW)
    expect(
      s.queue.slice(1).some((i) => i.card === first.card && i.template === first.template),
    ).toBe(true)
  })
  it('chooses first, then types', () => {
    const item = { deck, card: deck.cards[0], template: deck.templates[0] }
    expect(learnMethod('auto', item)).toBe('choose')
    expect(learnMethod('auto', item, { ...grade(undefined, 3, NOW), stage: 'type' })).toBe('type')
    expect(learnMethod('type', { ...item, template: deck.templates[2] })).toBe('choose')
    expect(nextStage('choose', true, undefined)).toBe('type')
    expect(nextStage('type', false, 'type')).toBe('choose')
  })
})
