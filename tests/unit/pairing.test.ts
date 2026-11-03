import { describe, expect, it } from 'vitest'
import { parsePairingLink } from '../../src/lib/pairing'

describe('pairing links', () => {
  it('reads the token, gist and deck library', () => {
    expect(
      parsePairingLink(
        'https://flash.jeroenjanssens.com/#/pair?t=github_pat_abc&g=123def&r=jeroenjanssens%2Fflash-decks',
      ),
    ).toEqual({ token: 'github_pat_abc', gist: '123def', repo: 'jeroenjanssens/flash-decks' })
  })
  it('only needs a token', () => {
    expect(parsePairingLink('http://localhost:5173/#/pair?t=tok')).toEqual({
      token: 'tok',
      gist: undefined,
      repo: undefined,
    })
  })
  it('ignores other links and QR codes', () => {
    expect(parsePairingLink('https://example.com/')).toBeUndefined()
    expect(parsePairingLink('https://flash.jeroenjanssens.com/#/profiles?t=tok')).toBeUndefined()
    expect(parsePairingLink('https://flash.jeroenjanssens.com/#/pair?g=123')).toBeUndefined()
    expect(parsePairingLink('hello')).toBeUndefined()
  })
})
