/** A tiny hash router: `#/deck/abc/learn?x=1` → segments ['deck', 'abc', 'learn'], query {x: '1'}. */

export interface Route {
  segments: string[]
  query: Record<string, string>
}

export function parseHash(hash: string): Route {
  const [path, search = ''] = hash.replace(/^#\/?/, '').split('?')
  const segments = path.split('/').filter(Boolean).map(decodeURIComponent)
  const query: Record<string, string> = {}
  for (const [k, v] of new URLSearchParams(search)) query[k] = v
  return { segments, query }
}

export function buildHash(path: string, query: Record<string, string | undefined> = {}): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') params.set(k, v)
  const search = params.toString()
  return `#/${path.replace(/^\//, '')}${search ? `?${search}` : ''}`
}

export const route = $state<Route>(parseHash(typeof location === 'undefined' ? '' : location.hash))

export function startRouter(): () => void {
  const update = () => {
    const next = parseHash(location.hash)
    route.segments = next.segments
    route.query = next.query
    window.scrollTo(0, 0)
  }
  window.addEventListener('hashchange', update)
  return () => window.removeEventListener('hashchange', update)
}

export function navigate(path: string, query?: Record<string, string | undefined>): void {
  location.hash = buildHash(path, query)
}

/** Replace the current entry, e.g. to drop a token from the address bar. */
export function replace(path: string, query?: Record<string, string | undefined>): void {
  history.replaceState(null, '', buildHash(path, query))
  const next = parseHash(location.hash)
  route.segments = next.segments
  route.query = next.query
}

export function href(path: string, query?: Record<string, string | undefined>): string {
  return buildHash(path, query)
}
