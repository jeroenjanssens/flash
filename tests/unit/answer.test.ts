import { describe, expect, it } from 'vitest'
import {
  checkTyped,
  diffLetters,
  distance,
  hintPattern,
  normalize,
} from '../../src/lib/study/answer'

describe('normalize', () => {
  it('ignores case, spaces, hyphens and final punctuation', () => {
    expect(normalize('  Eco-House. ')).toBe('eco house')
    expect(normalize('it’s')).toBe("it's")
  })
})

describe('checkTyped', () => {
  const v = { text: 'draw bridge', accept: ['drawbridge'] }
  it('accepts the word, its alternatives and spacing variants', () => {
    expect(checkTyped('draw bridge', v).verdict).toBe('correct')
    expect(checkTyped('Drawbridge', v).verdict).toBe('correct')
    expect(checkTyped('draw-bridge', v).verdict).toBe('correct')
    expect(checkTyped('eco house', { text: 'eco-house' }).verdict).toBe('correct')
  })
  it('calls one mistake in a normal word close', () => {
    expect(checkTyped('fridg', { text: 'fridge' }).verdict).toBe('close')
    expect(checkTyped('firdge', { text: 'fridge' }).verdict).toBe('close')
    expect(checkTyped('kinghts', { text: 'knights' }).verdict).toBe('close')
  })
  it('is strict for short words and empty input', () => {
    expect(checkTyped('cap', { text: 'cup' }).verdict).toBe('wrong')
    expect(checkTyped('', { text: 'cup' }).verdict).toBe('wrong')
    expect(checkTyped('spoon', { text: 'fork' }).verdict).toBe('wrong')
  })
  it('allows two mistakes in long words', () => {
    expect(checkTyped('insulasion', { text: 'insulation' }).verdict).toBe('close')
  })
})

describe('distance', () => {
  it('counts a swap as one edit', () => {
    expect(distance('ab', 'ba')).toBe(1)
    expect(distance('kitten', 'sitting')).toBe(3)
  })
})

describe('diffLetters', () => {
  it('marks wrong, missing and extra letters', () => {
    expect(diffLetters('fridg', 'fridge')).toEqual([
      { text: 'fridg', kind: 'same' },
      { text: 'e', kind: 'missing' },
    ])
    expect(diffLetters('stell', 'steel')).toEqual([
      { text: 'ste', kind: 'same' },
      { text: 'l', kind: 'wrong' },
      { text: 'l', kind: 'same' },
    ])
  })
})

describe('hintPattern', () => {
  it('shows letters step by step and keeps spaces', () => {
    expect(hintPattern('cup', 1)).toBe('_ _ _')
    expect(hintPattern('cup', 2)).toBe('c _ _')
    expect(hintPattern('in the past', 2)).toBe('i _   t _ _   p _ _ _')
    expect(hintPattern('eco-house', 2)).toBe('e _ _ - h _ _ _ _')
  })
})

import { format } from '../../src/lib/i18n/format'
describe('format', () => {
  it('fills in placeholders, also inside choices', () => {
    expect(format('{count|1 card|{count} cards}', { count: 1 })).toBe('1 card')
    expect(format('{count|1 card|{count} cards}', { count: 3 })).toBe('3 cards')
    expect(format('Hi {name}!', { name: 'Florien' })).toBe('Hi Florien!')
    expect(format('{days|day|days} {x}', { days: 2 })).toBe('days {x}')
  })
})

describe('checkTyped diff', () => {
  it('only explains letters for nearly right answers', () => {
    expect(checkTyped('blu', { text: 'pink' }).diff).toEqual([])
    expect(checkTyped('fridj', { text: 'fridge' }).diff.length).toBeGreaterThan(1)
  })
})
