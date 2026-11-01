import { describe, expect, it } from 'vitest'
import { mergeProfiles, mergeSaves } from '../../src/lib/storage/merge'
import { emptySave, type ReviewEntry } from '../../src/lib/storage/schema'
import { grade } from '../../src/lib/srs/scheduler'
import { migrate } from '../../src/lib/storage/persistence'

const entry = (t: number, card = 'a'): ReviewEntry => ({
  t,
  deck: 'd',
  card,
  template: 'x',
  mode: 'learn',
  method: 'type',
  correct: true,
  hints: 0,
  ms: 1000,
})

describe('mergeSaves', () => {
  it('keeps the newest review of each item and the union of the logs', () => {
    const a = emptySave('p')
    const b = emptySave('p')
    a.decks.d = { updatedAt: 1, items: { a: { x: grade(undefined, 3, 1000) } } }
    b.decks.d = {
      updatedAt: 2,
      testDate: '2026-11-06',
      items: { a: { x: grade(undefined, 1, 5000) }, b: { x: grade(undefined, 3, 10) } },
    }
    a.log = [entry(1), entry(3)]
    b.log = [entry(2), entry(3)]
    const m = mergeSaves(a, b)
    expect(m.decks.d.items.a.x.last_review).toBe(5000)
    expect(Object.keys(m.decks.d.items)).toEqual(['a', 'b'])
    expect(m.decks.d.testDate).toBe('2026-11-06')
    expect(m.log.map((e) => e.t)).toEqual([1, 2, 3])
    expect(mergeSaves(b, a)).toEqual(m)
  })
  it('takes the most recently changed settings', () => {
    const a = emptySave('p')
    const b = emptySave('p')
    b.settings.voice = 'male'
    b.settingsUpdatedAt = 10
    expect(mergeSaves(a, b).settings.voice).toBe('male')
  })
})

describe('mergeProfiles', () => {
  it('keeps every profile once, newest first wins, deletions included', () => {
    const p = { id: '1', name: 'Florien', avatar: '🦊', color: '#f00', createdAt: 1, updatedAt: 1 }
    const merged = mergeProfiles(
      [p],
      [
        { ...p, name: 'Flo', updatedAt: 2, deletedAt: 2 },
        { ...p, id: '2', createdAt: 2 },
      ],
    )
    expect(merged.map((x) => [x.id, x.name, !!x.deletedAt])).toEqual([
      ['1', 'Flo', true],
      ['2', 'Florien', false],
    ])
  })
})

describe('migrate', () => {
  it('repairs bad settings and drops junk', () => {
    const s = migrate(
      { settings: { voice: 'robot', dailyGoal: 50 }, log: [1, entry(5)], decks: { d: 3 } },
      'p',
    )
    expect(s.settings.voice).toBe('random')
    expect(s.settings.dailyGoal).toBe(50)
    expect(s.log).toHaveLength(1)
    expect(s.decks).toEqual({})
  })
})
