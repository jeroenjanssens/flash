import { expect, test } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encode } from 'uqr'

/**
 * Chromium's fake camera plays a video file: here, a still of the pairing QR code of another
 * device, so scanning it in the app can be tested end to end.
 */
const LINK = 'https://flash.jeroenjanssens.com/#/pair?t=github_pat_scanned&g=abc123'

function qrVideo(text: string): string {
  const { size, data } = encode(text, { border: 4 })
  const width = 640
  const height = 480
  const cell = Math.floor((height * 0.8) / size)
  const left = Math.floor((width - size * cell) / 2)
  const top = Math.floor((height - size * cell) / 2)
  const luma = Buffer.alloc(width * height, 235)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (data[y][x])
        for (let dy = 0; dy < cell; dy++)
          luma.fill(
            16,
            (top + y * cell + dy) * width + left + x * cell,
            (top + y * cell + dy) * width + left + (x + 1) * cell,
          )
  const chroma = Buffer.alloc((width / 2) * (height / 2) * 2, 128)
  const frame = Buffer.concat([Buffer.from('FRAME\n'), luma, chroma])
  const file = join(tmpdir(), `flash-pairing-qr-${process.pid}.y4m`)
  writeFileSync(
    file,
    Buffer.concat([
      Buffer.from(`YUV4MPEG2 W${width} H${height} F10:1 Ip A1:1 C420jpeg\n`),
      frame,
      frame,
    ]),
  )
  return file
}

test.use({
  permissions: ['camera'],
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${qrVideo(LINK)}`,
    ],
  },
})

test('a device connects by scanning the QR code of another device', async ({ page }) => {
  let token = ''
  await page.route('https://api.github.com/gists/abc123', async (route) => {
    token = (await route.request().headerValue('authorization')) ?? ''
    await route.fulfill({ json: { id: 'abc123', files: {} } })
  })
  await page.goto('/#/parent')
  await page.getByRole('button', { name: 'QR-code scannen' }).click()
  await expect(page.getByText('Dit apparaat is gekoppeld!')).toBeVisible()
  expect(token).toBe('Bearer github_pat_scanned')
  await expect(page.getByRole('button', { name: 'Apparaat koppelen' })).toBeVisible()
  expect(await page.evaluate(() => Object.entries(localStorage))).toEqual(
    expect.arrayContaining([expect.arrayContaining(['abc123'])]),
  )
})
