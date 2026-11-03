import { describe, expect, it } from 'vitest'
import { nextSample } from '../../src/lib/audio/engine'

describe('flip samples', () => {
  it('never plays the same sample twice in a row, and uses all of them', () => {
    let last = -1
    const used = new Set<number>()
    for (let n = 0; n < 1000; n++) {
      const i = nextSample(last, 3)
      expect(i).not.toBe(last)
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(3)
      used.add(i)
      last = i
    }
    expect(used.size).toBe(3)
  })
  it('can start with any sample', () => {
    expect([0, 0.5, 0.99].map((r) => nextSample(-1, 3, () => r))).toEqual([0, 1, 2])
  })
})
