export type Params = Record<string, string | number>

/**
 * Fill in `{name}` placeholders. A placeholder can choose by number:
 * `{count|card|cards}` gives the first form when the number is 1.
 */
export function format(message: string, params: Params = {}): string {
  // Choices first (their forms may contain placeholders themselves), then plain placeholders.
  const chosen = message.replace(
    /\{(\w+)\|((?:[^|{}]|\{\w+\})*)\|((?:[^{}]|\{\w+\})*)\}/g,
    (whole, name: string, one: string, other: string) => {
      const value = params[name]
      if (value === undefined) return whole
      return Number(value) === 1 ? one : other
    },
  )
  return chosen.replace(/\{(\w+)\}/g, (whole, name: string) =>
    params[name] === undefined ? whole : String(params[name]),
  )
}

/** The placeholder names used in a message, for checking translations. */
export function placeholders(message: string): string[] {
  return [...new Set([...message.matchAll(/\{(\w+)/g)].map((m) => m[1]))].sort()
}
