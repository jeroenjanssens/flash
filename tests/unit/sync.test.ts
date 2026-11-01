import { describe, expect, it } from 'vitest'
import { GitHub } from '../../src/lib/github'
import {
  GIST_DESCRIPTION,
  GistClient,
  PROFILES_FILE,
  progressFile,
  syncFamily,
  type Family,
} from '../../src/lib/storage/gist'
import { emptySave, type Profile } from '../../src/lib/storage/schema'
import { packDeck, unpackDeck } from '../../src/lib/deck/zip'
import { testDeck } from '../fixtures/deck'

/** A fake GitHub gist API that keeps one gist in memory. */
function fakeGitHub() {
  const gists: Record<
    string,
    { id: string; description: string; files: Record<string, { content: string }> }
  > = {}
  let next = 1
  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url).replace('https://api.github.com', '')
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
    if (path.startsWith('/gists?')) return json(Object.values(gists))
    if (path === '/gists' && init?.method === 'POST') {
      const id = `g${next++}`
      gists[id] = { id, description: body.description, files: body.files }
      return json(gists[id], 201)
    }
    const id = path.split('/')[2]
    if (!gists[id]) return json({}, 404)
    if (init?.method === 'PATCH') {
      for (const [name, file] of Object.entries(
        body.files as Record<string, { content: string } | null>,
      )) {
        if (file === null) delete gists[id].files[name]
        else gists[id].files[name] = file
      }
    }
    return json(gists[id])
  }
  return { gists, client: new GistClient(new GitHub('token', fetcher as typeof fetch)) }
}

const profile = (id: string, name: string): Profile => ({
  id,
  name,
  avatar: '🦊',
  color: '#f00',
  createdAt: 1,
  updatedAt: 1,
})

describe('syncFamily', () => {
  it('creates the gist, then merges two devices', async () => {
    const { gists, client } = fakeGitHub()
    const a: Family = { profiles: [profile('f', 'Florien')], saves: { f: emptySave('f') } }
    a.saves.f.log.push({
      t: 1,
      deck: 'd',
      card: 'c',
      template: 't',
      mode: 'learn',
      method: 'type',
      correct: true,
      hints: 0,
      ms: 1,
    })
    const first = await syncFamily(a, client)
    const gist = gists[first.gistId]
    expect(gist.description).toBe(GIST_DESCRIPTION)
    expect(Object.keys(gist.files).sort()).toEqual([PROFILES_FILE, progressFile('f')])

    // Another device, with Olivier and another answer for Florien.
    const b: Family = {
      profiles: [profile('f', 'Florien'), profile('o', 'Olivier')],
      saves: { f: emptySave('f'), o: emptySave('o') },
    }
    b.saves.f.log.push({
      t: 2,
      deck: 'd',
      card: 'c',
      template: 't',
      mode: 'learn',
      method: 'type',
      correct: false,
      hints: 0,
      ms: 1,
    })
    const second = await syncFamily(b, client)
    expect(second.gistId).toBe(first.gistId)
    expect(second.family.profiles.map((p) => p.name)).toEqual(['Florien', 'Olivier'])
    expect(second.family.saves.f.log.map((e) => e.t)).toEqual([1, 2])
    expect(Object.keys(gist.files)).toContain(progressFile('o'))
  })

  it('removes the progress of a deleted profile', async () => {
    const { gists, client } = fakeGitHub()
    const fam: Family = {
      profiles: [profile('f', 'Florien'), profile('o', 'Olivier')],
      saves: { f: emptySave('f'), o: emptySave('o') },
    }
    const { gistId } = await syncFamily(fam, client)
    const deleted = {
      ...fam,
      profiles: [fam.profiles[0], { ...fam.profiles[1], deletedAt: 5, updatedAt: 5 }],
    }
    const result = await syncFamily(deleted, client, gistId)
    expect(result.family.saves.o).toBeUndefined()
    expect(Object.keys(gists[gistId].files)).not.toContain(progressFile('o'))
  })
})

describe('zip', () => {
  it('packs and unpacks a deck with its media', async () => {
    const deck = testDeck()
    const blob = await packDeck(
      deck,
      'test',
      async (src) => new Blob([src], { type: 'image/webp' }),
    )
    const { deck: back, media, warnings } = unpackDeck(new Uint8Array(await blob.arrayBuffer()))
    expect(back.id).toBe(deck.id)
    expect(media.size).toBe(14) // 7 pictures + 7 audio clips
    expect(await media.get('media/fork.webp')!.text()).toBe('media/fork.webp')
    expect(warnings).toEqual([])
  })
})
