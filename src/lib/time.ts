export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

/** A local calendar day, `YYYY-MM-DD`. */
export function dayKey(t: number): string {
  const d = new Date(t)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Local midnight at the start of a `YYYY-MM-DD` day. */
export function startOfDay(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d + n).getTime())
}

/** Whole calendar days from `now` until a day (0 = today, negative = past). */
export function daysUntil(day: string, now: number): number {
  return Math.round((startOfDay(day) - startOfDay(dayKey(now))) / DAY)
}
