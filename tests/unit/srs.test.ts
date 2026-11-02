import { describe, expect, it } from 'vitest'
import { applyAnswer } from '../../src/lib/study/apply'
import { capForTest, grade, retentionFor } from '../../src/lib/srs/scheduler'
import {
  Session,
  buildQueue,
  deckCounts,
  learnMethod,
  nextStage,
  spread,
} from '../../src/lib/srs/queue'
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

describe('session progress', () => {
  it('moves on every answer and counts finished questions', () => {
    const deck = testDeck()
    const save = emptySave('p')
    save.settings.newPerDay = 2
    const s = new Session(buildQueue([deck], save, NOW, 50))
    expect([s.total, s.remaining, s.progress]).toEqual([4, 4, 0])
    // A first good answer: the question comes back, so half done.
    s.next(grade(undefined, 3, NOW), NOW)
    expect(s.remaining).toBe(4)
    expect(s.progress).toBe(0.125)
    // A review that's due in days: finished.
    s.next({ ...grade(undefined, 4, NOW), due: NOW + 5 * DAY }, NOW)
    expect(s.remaining).toBe(3)
    expect(s.progress).toBe(0.375)
  })
})

describe('questions about the same card are spread out', () => {
  const deck = testDeck()
  const all = deck.templates.map((t) => t.id)
  const key = (i: { card: { id: string }; template: { id: string } }) =>
    `${i.card.id}:${i.template.id}`
  /** The smallest number of questions between two questions about the same card. */
  const minGap = (q: { card: { id: string } }[]) => {
    let min = Infinity
    q.forEach((item, i) => {
      const j = q.findIndex((other, k) => k > i && other.card.id === item.card.id)
      if (j > 0) min = Math.min(min, j - i - 1)
    })
    return min
  }
  const known = (now: number) => ({
    ...grade(undefined, 4, now - 5 * DAY),
    state: 2 as const,
    due: now - DAY,
  })

  it('starts new cards with two templates, even when all are on', () => {
    const save = emptySave('p')
    save.settings.newPerDay = 7
    save.decks[deck.id] = { updatedAt: 0, items: {}, templates: all }
    const q = buildQueue([deck], save, NOW, 100)
    expect(q).toHaveLength(14)
    expect(new Set(q.map((i) => i.template.id))).toEqual(
      new Set(['picture-to-word', 'dutch-to-english']),
    )
    expect(minGap(q)).toBeGreaterThanOrEqual(4)
  })

  it('switching on templates for known cards adds one per card per day, spread out', () => {
    // The situation that showed the problem: cards learned with two templates, then all on.
    const save = emptySave('p')
    save.settings.newPerDay = 0
    const r = known(NOW)
    save.decks[deck.id] = {
      updatedAt: 0,
      templates: all,
      items: Object.fromEntries(
        deck.cards.map((c) => [
          c.id,
          { 'picture-to-word': r, 'dutch-to-english': { ...r, due: NOW - 2 * DAY } },
        ]),
      ),
    }
    const q = buildQueue([deck], save, NOW, 100)
    for (const card of deck.cards) {
      const mine = q.filter((i) => i.card.id === card.id).map((i) => i.template.id)
      // One review (the most overdue of the two) and one template it hasn't been asked with.
      expect(mine).toEqual(['dutch-to-english', 'word-to-picture'])
    }
    expect(minGap(q)).toBeGreaterThanOrEqual(4)
    expect(deckCounts(deck, save, NOW).due).toBe(q.length)
  })

  it('buries the other due reviews of a card until the next day', () => {
    const save = emptySave('p')
    save.settings.newPerDay = 0
    const r = known(NOW)
    save.decks[deck.id] = {
      updatedAt: 0,
      items: { fork: { 'picture-to-word': r, 'dutch-to-english': r } },
    }
    expect(buildQueue([deck], save, NOW, 100).map(key)).toEqual(['fork:picture-to-word'])
    // Both were learned days ago (that's in the log).
    for (const template of ['picture-to-word', 'dutch-to-english'])
      save.log.push({
        t: NOW - 5 * DAY,
        deck: deck.id,
        card: 'fork',
        template,
        mode: 'learn',
        method: 'type',
        correct: true,
        hints: 0,
        ms: 1,
      })
    // After reviewing it today, the other one waits for tomorrow…
    save.log.push({
      t: NOW - 60_000,
      deck: deck.id,
      card: 'fork',
      template: 'picture-to-word',
      mode: 'learn',
      method: 'type',
      correct: true,
      hints: 0,
      ms: 1,
    })
    save.decks[deck.id].items.fork['picture-to-word'] = {
      ...r,
      due: NOW + 5 * DAY,
      last_review: NOW - 60_000,
    }
    expect(buildQueue([deck], save, NOW, 100)).toEqual([])
    // …and comes tomorrow.
    expect(buildQueue([deck], save, NOW + DAY, 100).map(key)).toEqual(['fork:dutch-to-english'])
  })

  it('always asks learning steps', () => {
    const save = emptySave('p')
    save.settings.newPerDay = 0
    const learning = { ...grade(undefined, 1, NOW - 20 * 60_000), due: NOW - 60_000 }
    save.decks[deck.id] = {
      updatedAt: 0,
      items: { fork: { 'picture-to-word': learning, 'dutch-to-english': learning } },
    }
    expect(buildQueue([deck], save, NOW, 100).map(key).sort()).toEqual([
      'fork:dutch-to-english',
      'fork:picture-to-word',
    ])
  })

  it('spread keeps the order when nothing is too close', () => {
    const q = buildQueue([deck], emptySave('p'), NOW, 100)
    expect(spread(q)).toEqual(q)
    const a = { deck, card: deck.cards[0], template: deck.templates[0] }
    const b = { ...a, template: deck.templates[1] }
    const others = deck.cards
      .slice(1, 5)
      .map((card) => ({ deck, card, template: deck.templates[0] }))
    expect(spread([a, b, ...others]).map(key)).toEqual([a, ...others, b].map(key))
  })

  it('a question that comes back is not put next to its sibling', () => {
    const items = deck.cards
      .slice(0, 5)
      .map((card) => ({ deck, card, template: deck.templates[0] }))
    // fork's other template is fourth: coming back three on would be right next to it.
    items.splice(3, 0, { deck, card: deck.cards[0], template: deck.templates[1] })
    const s = new Session(items)
    s.next(grade(undefined, 1, NOW), NOW)
    const forks = s.queue.map((q, i) => (q.card.id === 'fork' ? i : -1)).filter((i) => i >= 0)
    expect(forks).toHaveLength(2)
    expect(Math.abs(forks[1] - forks[0])).toBeGreaterThan(2)
  })
})

describe('one more round', () => {
  const deck = testDeck()
  const HOUR = 3_600_000
  const reviewed = (daysAgo: number, stability: number) => ({
    ...grade(undefined, 4, NOW - daysAgo * DAY),
    state: 2 as const,
    stability,
    last_review: NOW - daysAgo * DAY,
    due: NOW + 3 * DAY,
  })
  const asked = (card: string, template: string, t: number) => ({
    t,
    deck: deck.id,
    card,
    template,
    mode: 'learn' as const,
    method: 'type' as const,
    correct: true,
    hints: 0,
    ms: 1,
  })

  it('a buried review comes back after half a day', () => {
    const save = emptySave('p')
    save.settings.newPerDay = 0
    const due = { ...reviewed(5, 4), due: NOW - DAY }
    save.decks[deck.id] = {
      updatedAt: 0,
      items: { fork: { 'picture-to-word': due, 'dutch-to-english': due } },
    }
    save.log.push(
      asked('fork', 'picture-to-word', NOW - 5 * DAY),
      asked('fork', 'dutch-to-english', NOW - 5 * DAY),
    )
    save.log.push(asked('fork', 'picture-to-word', NOW - 60_000))
    save.decks[deck.id].items.fork['picture-to-word'] = {
      ...due,
      due: NOW + 5 * DAY,
      last_review: NOW - 60_000,
    }
    expect(buildQueue([deck], save, NOW, 100)).toEqual([])
    expect(buildQueue([deck], save, NOW + 2 * HOUR, 100)).toEqual([])
    expect(buildQueue([deck], save, NOW + 5 * HOUR, 100).map((i) => i.template.id)).toEqual([
      'dutch-to-english',
    ])
  })

  it('asks the weakest cards first, one way each, not the ones just asked', () => {
    const save = emptySave('p')
    save.settings.newPerDay = 0
    save.decks[deck.id] = {
      updatedAt: 0,
      items: {
        fork: { 'picture-to-word': reviewed(3, 2), 'dutch-to-english': reviewed(3, 30) },
        knife: { 'picture-to-word': reviewed(3, 10), 'dutch-to-english': reviewed(3, 12) },
        spoon: { 'picture-to-word': reviewed(3, 3), 'dutch-to-english': reviewed(3, 1) },
        cup: { 'picture-to-word': reviewed(3, 1), 'dutch-to-english': reviewed(3, 1) },
      },
    }
    // cup was just asked.
    save.log.push(asked('cup', 'picture-to-word', NOW - 10 * 60_000))
    // Nothing is due, so a normal session is empty…
    expect(buildQueue([deck], save, NOW, 100)).toEqual([])
    // …and one more round asks the weakest first.
    const q = buildQueue([deck], save, NOW, 100, { extra: true })
    expect(q.map((i) => `${i.card.id}:${i.template.id}`)).toEqual([
      'spoon:dutch-to-english',
      'fork:picture-to-word',
      'knife:picture-to-word',
    ])
  })

  it('counts extra rounds for the schedule', () => {
    const save = emptySave('p')
    const item = { deck, card: deck.cards[0], template: deck.templates[0] }
    const r = applyAnswer(
      save,
      item,
      { method: 'type', correct: true, hints: 0, ms: 2000 },
      'extra',
      NOW,
    )
    expect(r).toBeDefined()
    expect(save.log[0].mode).toBe('extra')
  })

  it('gives extra new cards on top of the daily limit', () => {
    const save = emptySave('p')
    save.settings.newPerDay = 2
    for (const card of ['fork', 'knife'])
      save.log.push({ ...asked(card, 'picture-to-word', NOW - HOUR), intro: true })
    save.decks[deck.id] = {
      updatedAt: 0,
      items: Object.fromEntries(
        ['fork', 'knife'].map((c) => [
          c,
          { 'picture-to-word': { ...grade(undefined, 3, NOW - HOUR), due: NOW + DAY } },
        ]),
      ),
    }
    expect(buildQueue([deck], save, NOW, 100).filter((i) => i.intro)).toHaveLength(0)
    expect(buildQueue([deck], save, NOW, 100, { newBonus: 3 }).filter((i) => i.intro)).toHaveLength(
      3,
    )
  })

  it('aims for 97% on the last two days before a test', () => {
    expect(retentionFor(NOW, '2026-11-03')).toBe(0.97)
    expect(retentionFor(NOW, '2026-11-02')).toBe(0.97)
    expect(retentionFor(NOW, '2026-11-04')).toBe(0.95)
  })
})
