<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { parsePairingLink, type Pairing } from '../lib/pairing'
  import { t } from '../state/i18n.svelte'

  /**
   * Scan the pairing QR code of another device with the camera. Needed on iPad and iPhone: a Home
   * Screen app has its own storage, and a scanned link always opens in Safari instead.
   */
  let { onscan, onclose }: { onscan: (pairing: Pairing) => void; onclose: () => void } = $props()

  let video = $state<HTMLVideoElement>()
  let status = $state<'starting' | 'scanning' | 'denied' | 'unavailable'>('starting')
  let wrongCode = $state(false)
  let stream: MediaStream | undefined
  let frame = 0
  let stopped = false

  function stop() {
    stopped = true
    cancelAnimationFrame(frame)
    for (const track of stream?.getTracks() ?? []) track.stop()
    stream = undefined
  }

  onMount(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      status = 'unavailable'
      return
    }
    try {
      const [s, { default: jsQR }] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        }),
        import('jsqr'),
      ])
      if (stopped) {
        for (const track of s.getTracks()) track.stop()
        return
      }
      stream = s
      video!.srcObject = s
      await video!.play()
      status = 'scanning'

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      let last = 0
      const tick = (now: number) => {
        if (stopped) return
        frame = requestAnimationFrame(tick)
        // A few times a second is plenty, and keeps the iPad cool.
        if (now - last < 150 || !video || video.readyState < 2 || !video.videoWidth) return
        last = now
        const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight))
        canvas.width = Math.round(video.videoWidth * scale)
        canvas.height = Math.round(video.videoHeight * scale)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(image.data, image.width, image.height, {
          inversionAttempts: 'dontInvert',
        })
        if (!code) return
        const pairing = parsePairingLink(code.data)
        if (!pairing) {
          wrongCode = true
          return
        }
        stop()
        onscan(pairing)
      }
      frame = requestAnimationFrame(tick)
    } catch (err) {
      status =
        err instanceof DOMException && err.name === 'NotAllowedError' ? 'denied' : 'unavailable'
    }
  })

  onDestroy(stop)
</script>

<div class="scanner stack">
  {#if status === 'denied' || status === 'unavailable'}
    <p class="muted">{t(`scan.${status}`)}</p>
  {:else}
    <div class="view">
      <video bind:this={video} playsinline muted autoplay></video>
      <div class="frame" aria-hidden="true"></div>
    </div>
    <p class="muted small">{wrongCode ? t('scan.wrong') : t('scan.hint')}</p>
  {/if}
  <button
    class="btn"
    type="button"
    onclick={() => {
      stop()
      onclose()
    }}>{t('common.cancel')}</button
  >
</div>

<style>
  .scanner {
    justify-items: center;
    text-align: center;
  }
  .view {
    position: relative;
    width: min(100%, 360px);
    aspect-ratio: 1;
    border-radius: 16px;
    overflow: hidden;
    background: #000;
  }
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .frame {
    position: absolute;
    inset: 18%;
    border: 3px solid rgb(255 255 255 / 0.85);
    border-radius: 12px;
    box-shadow: 0 0 0 999px rgb(0 0 0 / 0.25);
  }
</style>
