/**
 * Sound: pronunciation clips (decoded once, played through Web Audio, which works reliably on
 * iOS once unlocked by a tap), speech synthesis as a fallback for decks without audio, and small
 * synthesised sound effects, so there are no sound files to license.
 */

export type Sfx = 'correct' | 'wrong' | 'close' | 'flip' | 'tap' | 'done' | 'record' | 'tick'

export class AudioEngine {
  private ctx: AudioContext | undefined
  private buffers = new Map<string, Promise<AudioBuffer | undefined>>()
  private playing: AudioBufferSourceNode | undefined
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
    }
    if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => {})
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
        const len = 0.12
        const noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate)
        const data = noise.getChannelData(0)
        for (let i = 0; i < data.length; i++)
          data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
        const src = ctx.createBufferSource()
        const filter = ctx.createBiquadFilter()
        const g = ctx.createGain()
        src.buffer = noise
        filter.type = 'bandpass'
        filter.frequency.setValueAtTime(1800, t)
        filter.frequency.exponentialRampToValueAtTime(5000, t + len)
        g.gain.value = 0.25
        src.connect(filter).connect(g).connect(ctx.destination)
        src.start(t)
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
