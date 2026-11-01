import type { TextValue } from '../deck/types'

/**
 * Make two spellings comparable: case, surrounding and double spaces, hyphens vs spaces,
 * curly vs straight apostrophes, and trailing punctuation don't matter.
 */
export function normalize(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[-‐‑–—_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?,;:]+$/, '')
    .trim()
}

/** Like normalize, but spaces don't count either: "draw bridge" = "drawbridge". */
const compact = (text: string) => normalize(text).replace(/ /g, '')

/** Edit distance with adjacent swaps (Damerau–Levenshtein, optimal string alignment). */
export function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  return d[a.length][b.length]
}

/** How many mistakes still count as "almost": none for short words, more for long ones. */
export function tolerance(length: number): number {
  if (length < 4) return 0
  if (length < 9) return 1
  return 2
}

export type Verdict = 'correct' | 'close' | 'wrong'

export interface Check {
  verdict: Verdict
  /** The accepted answer closest to what was typed. */
  expected: string
  /** Per letter of what was typed: whether it's right. */
  diff: DiffPart[]
}

export interface DiffPart {
  text: string
  kind: 'same' | 'wrong' | 'extra' | 'missing'
}

/** Check a typed answer against a text value and its accepted alternatives. */
export function checkTyped(input: string, value: TextValue): Check {
  const options = [value.text, ...(value.accept ?? [])]
  const typed = compact(input)
  if (typed && options.some((o) => compact(o) === typed))
    return {
      verdict: 'correct',
      expected: value.text,
      diff: [{ text: input.trim(), kind: 'same' }],
    }
  let best = value.text
  let bestDistance = Infinity
  for (const o of options) {
    const dist = distance(typed, compact(o))
    if (dist < bestDistance) [best, bestDistance] = [o, dist]
  }
  const close = typed.length > 0 && bestDistance <= tolerance(compact(best).length)
  return {
    verdict: close ? 'close' : 'wrong',
    expected: best,
    diff: diffLetters(normalize(input), normalize(best)),
  }
}

/** Align what was typed with the answer, letter by letter, to show where the mistakes are. */
export function diffLetters(typed: string, expected: string): DiffPart[] {
  const a = [...typed]
  const b = [...expected]
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
  const parts: DiffPart[] = []
  let i = a.length
  let j = b.length
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      parts.push({ text: a[i - 1], kind: a[i - 1] === b[j - 1] ? 'same' : 'wrong' })
      i--
      j--
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      parts.push({ text: a[i - 1], kind: 'extra' })
      i--
    } else {
      parts.push({ text: b[j - 1], kind: 'missing' })
      j--
    }
  }
  parts.reverse()
  // Merge neighbours of the same kind.
  const merged: DiffPart[] = []
  for (const p of parts) {
    const last = merged[merged.length - 1]
    if (last && last.kind === p.kind) last.text += p.text
    else merged.push({ ...p })
  }
  return merged
}

/**
 * A hint for a word: level 1 shows the number of letters, level 2 the first letter of every
 * word too, level 3 every other letter. Spaces, hyphens and apostrophes are always shown.
 */
export function hintPattern(text: string, level: number): string {
  if (level <= 0) return ''
  let index = 0
  return [...text]
    .map((ch) => {
      if (!/\p{L}|\p{N}/u.test(ch)) {
        index = 0
        return ch === ' ' ? '   ' : ch
      }
      const show = (level >= 2 && index === 0) || (level >= 3 && index % 2 === 0)
      index++
      return show ? ch : '_'
    })
    .join(' ')
    .replace(/ {4,}/g, '   ')
}

export const MAX_HINT = 3
