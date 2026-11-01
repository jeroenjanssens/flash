/** Talking to the GitHub API with a token kept in this browser only. */

export const API = 'https://api.github.com'

export type GitHubErrorCode = 'offline' | 'token' | 'scope' | 'notfound' | 'http'

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly code: GitHubErrorCode,
    readonly status?: number,
  ) {
    super(message)
  }
}

export type Fetch = typeof fetch

export class GitHub {
  constructor(
    private readonly token: string,
    private readonly fetcher: Fetch = (...args) => fetch(...args),
  ) {}

  async send(path: string, init: RequestInit = {}, accept = 'application/vnd.github+json') {
    let res: Response
    try {
      res = await this.fetcher(path.startsWith('https://') ? path : `${API}${path}`, {
        ...init,
        // A cached copy would be merged and written back, undoing another device's sync.
        cache: 'no-store',
        headers: {
          Accept: accept,
          Authorization: `Bearer ${this.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
      })
    } catch {
      throw new GitHubError('Could not reach GitHub', 'offline')
    }
    if (res.status === 401) throw new GitHubError('GitHub rejected the token', 'token', 401)
    if (res.status === 403) throw new GitHubError('The token may not do this', 'scope', 403)
    if (res.status === 404) throw new GitHubError('Not found', 'notfound', 404)
    if (!res.ok) throw new GitHubError(`GitHub returned ${res.status}`, 'http', res.status)
    return res
  }

  async json<T>(path: string, init: RequestInit = {}): Promise<T> {
    return (await (await this.send(path, init)).json()) as T
  }

  /** A file's raw bytes (works for private repositories, unlike raw.githubusercontent.com). */
  async raw(path: string): Promise<Blob> {
    return (await this.send(path, {}, 'application/vnd.github.raw+json')).blob()
  }
}

/** The next-page URL from a GitHub `Link` header (only ever on the API itself). */
export function nextPage(link: string | null): string | undefined {
  const url = link?.match(/<([^>]+)>;\s*rel="next"/)?.[1]
  return url?.startsWith(`${API}/`) ? url : undefined
}
