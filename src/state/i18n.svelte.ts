import { en, type MessageKey } from '../lib/i18n/en'
import { nl } from '../lib/i18n/nl'
import { format, type Params } from '../lib/i18n/format'
import { localized } from '../lib/deck/items'
import type { Localized } from '../lib/deck/types'
import { app } from './app.svelte'

export type Lang = 'nl' | 'en'

/** The interface language: the learner's setting, Dutch before a profile exists. */
export function lang(): Lang {
  return app.save?.settings.language ?? 'nl'
}

export function t(key: MessageKey, params?: Params): string {
  const table = lang() === 'nl' ? nl : en
  return format(table[key] ?? en[key], params)
}

/** Deck text (titles, names) in the interface language. */
export function loc(text: Localized | undefined): string {
  return localized(text, lang())
}

export function formatDate(
  day: string,
  options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' },
): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(lang() === 'nl' ? 'nl-NL' : 'en-GB', options)
}

export function formatNumber(n: number, digits = 0): string {
  return n.toLocaleString(lang() === 'nl' ? 'nl-NL' : 'en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/** 83 seconds → "1:23"; with tenths → "1:23.4". */
export function formatTime(ms: number, tenths = false): string {
  const total = Math.max(0, ms) / 1000
  const m = Math.floor(total / 60)
  const s = total - m * 60
  const sec = tenths ? s.toFixed(1).padStart(4, '0') : String(Math.floor(s)).padStart(2, '0')
  return `${m}:${sec}`.replace('.', lang() === 'nl' ? ',' : '.')
}
