import { GitHub, GitHubError, nextPage } from '../github'
import { mergeProfiles, mergeSaves } from './merge'
import { migrate, migrateProfiles } from './persistence'
import type { Profile, ProfileSave } from './schema'

/**
 * Progress syncs through one secret gist for the whole family: `flash-profiles.json` lists the
 * profiles, and every profile has its own `flash-progress-<id>.json`.
 */
export const GIST_DESCRIPTION = 'Flash — progress (synced by the Flash app)'
export const PROFILES_FILE = 'flash-profiles.json'
export const progressFile = (id: string) => `flash-progress-${id}.json`

interface GistFile {
  content?: string
  truncated?: boolean
  raw_url?: string
}

interface Gist {
  id: string
  description: string | null
  files: Record<string, GistFile | null>
}

export interface Family {
  profiles: Profile[]
  saves: Record<string, ProfileSave>
}

export class GistClient {
  constructor(readonly gh: GitHub) {}

  /** The id of our gist, if it exists. Looks through every page of the account's gists. */
  async find(): Promise<string | undefined> {
    let path: string | undefined = '/gists?per_page=100'
    while (path) {
      const res = await this.gh.send(path)
      const gists = (await res.json()) as Gist[]
      const ours = gists.find((g) => g.description === GIST_DESCRIPTION && PROFILES_FILE in g.files)
      if (ours) return ours.id
      path = nextPage(res.headers.get('Link'))
    }
    return undefined
  }

  private async content(file: GistFile): Promise<string> {
    if (file.truncated && file.raw_url) {
      const res = await fetch(file.raw_url, { cache: 'no-store' })
      return res.text()
    }
    return file.content ?? ''
  }

  /** The family's data in the gist, plus the raw text of each file (to skip unchanged writes). */
  async read(id: string): Promise<{ family: Family; raw: Record<string, string> }> {
    const gist = await this.gh.json<Gist>(`/gists/${id}`)
    const raw: Record<string, string> = {}
    for (const [name, file] of Object.entries(gist.files))
      if (file && name.startsWith('flash-')) raw[name] = await this.content(file)
    const profiles = raw[PROFILES_FILE] ? migrateProfiles(JSON.parse(raw[PROFILES_FILE])) : []
    const saves: Record<string, ProfileSave> = {}
    for (const p of profiles) {
      const text = raw[progressFile(p.id)]
      if (text) saves[p.id] = migrate(JSON.parse(text), p.id)
    }
    return { family: { profiles, saves }, raw }
  }

  async create(family: Family): Promise<string> {
    const gist = await this.gh.json<Gist>('/gists', {
      method: 'POST',
      body: JSON.stringify({ description: GIST_DESCRIPTION, public: false, files: files(family) }),
    })
    return gist.id
  }

  async update(id: string, changed: Record<string, { content: string } | null>): Promise<void> {
    if (!Object.keys(changed).length) return
    await this.gh.json<Gist>(`/gists/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ files: changed }),
    })
  }
}

function files(family: Family): Record<string, { content: string }> {
  const out: Record<string, { content: string }> = {
    [PROFILES_FILE]: { content: JSON.stringify(family.profiles) },
  }
  for (const p of family.profiles)
    if (!p.deletedAt && family.saves[p.id])
      out[progressFile(p.id)] = { content: JSON.stringify(family.saves[p.id]) }
  return out
}

/** Merge two copies of the family's data. Removed profiles lose their progress. */
export function mergeFamily(a: Family, b: Family): Family {
  const profiles = mergeProfiles(a.profiles, b.profiles)
  const saves: Record<string, ProfileSave> = {}
  for (const p of profiles) {
    if (p.deletedAt) continue
    const x = a.saves[p.id]
    const y = b.saves[p.id]
    if (x && y) saves[p.id] = mergeSaves(x, y)
    else if (x || y) saves[p.id] = structuredClone((x ?? y)!)
  }
  return { profiles, saves }
}

/**
 * Sync once: read the gist (finding or creating it if needed), merge it with the local data,
 * and write back only the files that changed. Returns the merged data and the gist id.
 */
export async function syncFamily(
  local: Family,
  client: GistClient,
  gistId?: string,
): Promise<{ family: Family; gistId: string }> {
  const id = gistId ?? (await client.find())
  if (!id) return { family: local, gistId: await client.create(local) }
  let remote: Awaited<ReturnType<GistClient['read']>>
  try {
    remote = await client.read(id)
  } catch (err) {
    // The gist was deleted: start a new one with what's here.
    if (err instanceof GitHubError && err.status === 404)
      return { family: local, gistId: await client.create(local) }
    throw err
  }
  const merged = mergeFamily(local, remote.family)
  const wanted = files(merged)
  const changed: Record<string, { content: string } | null> = {}
  for (const [name, file] of Object.entries(wanted))
    if (remote.raw[name] !== file.content) changed[name] = file
  for (const name of Object.keys(remote.raw))
    if (name.startsWith('flash-progress-') && !wanted[name]) changed[name] = null
  await client.update(id, changed)
  return { family: merged, gistId: id }
}
