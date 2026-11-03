/**
 * Sound: pronunciation clips (decoded once, played through Web Audio, which works reliably on
 * iOS once unlocked by a tap), speech synthesis as a fallback for decks without audio, and small
 * sound effects: synthesised, except for turning a card, which uses recordings of a page flip
 * (public domain, see public/sfx/sources.json).
 */

/** Page flips (Kenney's RPG Audio, CC0). */
const FLIPS = [1, 2, 3].map((n) => `${import.meta.env.BASE_URL}sfx/page-flip-${n}.mp3`)

/** A random one of `count` samples, but never `last` (the one played just before). */
export function nextSample(last: number, count: number, random = Math.random): number {
  if (count < 2) return 0
  if (last < 0 || last >= count) return Math.floor(random() * count)
  const i = Math.floor(random() * (count - 1))
  return i >= last ? i + 1 : i
}

export type Sfx = 'correct' | 'wrong' | 'close' | 'flip' | 'tap' | 'done' | 'record' | 'tick'

export class AudioEngine {
  private ctx: AudioContext | undefined
  private buffers = new Map<string, Promise<AudioBuffer | undefined>>()
  private playing: AudioBufferSourceNode | undefined
  private lastFlip = -1
  sounds = true

  /** Create or resume the audio context. Call on every user gesture (autoplay policies). */
  unlock(): void {
    try {
      // iOS 17+: play even when the ring/silent switch is on silent, like a media app.
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
      if (session && session.type !== 'playback') session.type = 'playback'
    } catch {
      // Not supported.
    }
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return
      this.ctx = new Ctx()
      // Decode the flips now, so the first one plays without a delay.
      for (const url of FLIPS) void this.load(url)
    }
    if (this.ctx.state !== 'running') {
      void this.ctx.resume().catch(() => {})
      // WebKit only lets the context make sound once something has played during a tap, so
      // play a moment of silence (resuming alone isn't always enough on iPad and iPhone).
      try {
        const source = this.ctx.createBufferSource()
        source.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate)
        source.connect(this.ctx.destination)
        source.start()
      } catch {
        // Not allowed yet: the next tap tries again.
      }
    }
  }

  private load(url: string): Promise<AudioBuffer | undefined> {
    let p = this.buffers.get(url)
    if (!p) {
      p = (async () => {
        try {
          const res = await fetch(url)
          if (!res.ok) return undefined
          const data = await res.arrayBuffer()
          this.unlock()
          return await this.ctx!.decodeAudioData(data)
        } catch {
          this.buffers.delete(url)
          return undefined
        }
      })()
      this.buffers.set(url, p)
    }
    return p
  }

  /** Decode a clip ahead of time, so it plays without delay. */
  preload(url: string | undefined): void {
    if (url && this.ctx) void this.load(url)
  }

  stop(): void {
    try {
      this.playing?.stop()
    } catch {
      // Already stopped.
    }
    this.playing = undefined
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
  }

  /** Play a clip; resolves when it has finished (false if it couldn't be played). */
  async play(url: string): Promise<boolean> {
    this.unlock()
    const buffer = await this.load(url)
    if (!buffer || !this.ctx) return false
    this.stop()
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.connect(this.ctx.destination)
    this.playing = source
    return new Promise((resolve) => {
      source.onended = () => resolve(true)
      source.start()
    })
  }

  /** Say a text with the device's speech synthesis (for text without recorded audio). */
  speak(text: string, lang: string, gender?: 'female' | 'male' | 'other'): Promise<boolean> {
    if (typeof speechSynthesis === 'undefined') return Promise.resolve(false)
    this.stop()
    const voices = speechSynthesis
      .getVoices()
      .filter((v) => v.lang.replace('_', '-').startsWith(lang))
    const base = lang.split('-')[0]
    const pool = voices.length
      ? voices
      : speechSynthesis.getVoices().filter((v) => v.lang.startsWith(base))
    const byGender = pool.filter((v) =>
      gender === 'male'
        ? /male|daniel|arthur|oliver|george/i.test(v.name) && !/female/i.test(v.name)
        : /female|samantha|kate|serena|martha|emma/i.test(v.name),
    )
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = 0.9
    const voice = byGender[0] ?? pool[0]
    if (voice) u.voice = voice
    return new Promise((resolve) => {
      u.onend = () => resolve(true)
      u.onerror = () => resolve(false)
      speechSynthesis.speak(u)
    })
  }

  /** A short sound effect. */
  sfx(name: Sfx): void {
    if (!this.sounds) return
    this.unlock()
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running') return
    const t = ctx.currentTime + 0.01
    const tone = (
      freq: number,
      start: number,
      length: number,
      type: OscillatorType = 'sine',
      gain = 0.18,
    ) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, t + start)
      g.gain.setValueAtTime(0, t + start)
      g.gain.linearRampToValueAtTime(gain, t + start + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, t + start + length)
      osc.connect(g).connect(ctx.destination)
      osc.start(t + start)
      osc.stop(t + start + length + 0.02)
    }
    switch (name) {
      case 'correct':
        tone(784, 0, 0.18, 'triangle') // G5
        tone(1175, 0.09, 0.32, 'triangle') // D6
        break
      case 'close':
        tone(659, 0, 0.2, 'triangle', 0.12)
        tone(698, 0.12, 0.25, 'triangle', 0.12)
        break
      case 'wrong':
        tone(220, 0, 0.28, 'sine', 0.2)
        tone(185, 0.12, 0.32, 'sine', 0.16)
        break
      case 'flip': {
        const i = nextSample(this.lastFlip, FLIPS.length)
        this.lastFlip = i
        void this.load(FLIPS[i]).then((buffer) => {
          if (!buffer) return
          // On its own, so it doesn't stop a word that's being said.
          const src = ctx.createBufferSource()
          const g = ctx.createGain()
          src.buffer = buffer
          g.gain.value = 0.7
          src.connect(g).connect(ctx.destination)
          src.start()
        })
        break
      }
      case 'tap':
        tone(1320, 0, 0.05, 'sine', 0.06)
        break
      case 'tick':
        tone(1760, 0, 0.03, 'square', 0.03)
        break
      case 'done':
        ;[523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.35, 'triangle', 0.14))
        break
      case 'record':
        ;[784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, i * 0.07, 0.4, 'triangle', 0.12))
        break
    }
  }
}
