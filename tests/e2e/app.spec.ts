import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

/** The built-in Colours deck: Dutch → English, to type right answers. */
const deck = JSON.parse(readFileSync('public/decks/colours/deck.json', 'utf8'))
const english = new Map<string, string>(
  deck.cards.map((c: { fields: Record<string, { text: string }> }) => [
    c.fields.translation.text,
    c.fields.word.text,
  ]),
)

async function createProfile(page: Page, name = 'Florien') {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Welkom bij Flash!' })).toBeVisible()
  await page.getByLabel('Naam').fill(name)
  await page.getByRole('button', { name: 'Aan de slag!' }).click()
  await expect(page.getByRole('heading', { name: new RegExp(name) })).toBeVisible()
}

/** The English word for the current question: from the picture's file name or the Dutch word. */
async function expected(page: Page): Promise<string> {
  const img = page.locator('.prompt img')
  if (await img.count()) return (await img.getAttribute('src'))!.match(/(\w+)\.svg$/)![1]
  return english.get((await page.locator('.prompt .word').first().textContent())!.trim())!
}

/** Answer the current question right (or wrong). */
async function answer(page: Page, right = true) {
  const word = await expected(page)
  const input = page.getByPlaceholder('Typ het woord')
  if (await input.isVisible()) {
    await input.fill(right ? word : 'zzz')
    await page.getByRole('button', { name: /Kijk na/ }).click()
    return
  }
  const options = page.locator('.option')
  await options.first().waitFor()
  const match = options.filter({ hasText: new RegExp(`^\\s*${word}\\s*\\d?\\s*$`) })
  await (right ? match : options.filter({ hasNot: page.locator(`text=${word}`) })).first().click()
}

/** Answer everything right until the session summary shows. */
async function finishSession(page: Page) {
  for (let i = 0; i < 200; i++) {
    if (await page.getByRole('heading', { name: /Perfect!|Goed gedaan!/ }).isVisible()) return
    const gotIt = page.getByRole('button', { name: /Begrepen/ })
    const next = page.getByRole('button', { name: /Verder/ })
    if (await gotIt.isVisible()) await gotIt.click()
    else if (await next.isVisible()) await next.click()
    else if (await page.locator('.prompt').isVisible()) await answer(page)
    await page.waitForTimeout(30)
  }
  throw new Error('the session did not finish')
}

test('a first visit creates a profile and shows the decks', async ({ page }) => {
  await createProfile(page)
  await expect(page.getByText('Er wachten 20 kaarten op je.')).toBeVisible()
  await expect(page.getByRole('link', { name: /Stepping Stones Jr\. Thema 1/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Kleuren/ })).toBeVisible()
})

test('a Learn session introduces new words and ends with a summary', async ({ page }) => {
  await createProfile(page)
  await page.goto(`/#/deck/${deck.id}/learn`)
  await expect(page.getByText('Nieuw woord')).toBeVisible()
  await finishSession(page)
  await expect(page.getByRole('heading', { name: 'Perfect!' })).toBeVisible()
  await page.getByRole('link', { name: 'Klaar' }).click()
  // Back on the deck: the 10 new cards of today are done; 1 is left for tomorrow.
  await expect(page.getByText('Klaar voor vandaag!')).toBeVisible()
  // Practice counts for the daily goal and the streak.
  await page.goto('/')
  await expect(page.locator('.streak strong')).toHaveText('1')
})

test('typing practice accepts the right word and explains a near miss', async ({ page }) => {
  await createProfile(page)
  await page.getByRole('link', { name: /Kleuren/ }).click()
  await page.getByRole('link', { name: /Typen/ }).click()
  await page.getByRole('button', { name: 'Nederlands → Engels' }).click()
  await page.getByRole('button', { name: /Start met 11 kaarten/ }).click()
  // First question: type it with one letter missing, then fix it.
  const dutch = (await page.locator('.prompt .word').textContent())!.trim()
  const word = english.get(dutch)!
  const input = page.getByPlaceholder('Typ het woord')
  if (word.length >= 4) {
    await input.fill(word.slice(0, -1))
    await page.getByRole('button', { name: /Kijk na/ }).click()
    await expect(page.getByText('Bijna! Kijk nog eens:')).toBeVisible()
  }
  await input.fill(word.toUpperCase())
  await page.getByRole('button', { name: /Kijk na/ }).click()
  await expect(page.getByText('Goed zo!')).toBeVisible()
  // Hints show the letters.
  await page.getByRole('button', { name: /Verder/ }).click()
  await page.getByRole('button', { name: /Hint/ }).click()
  await expect(page.locator('.hint')).toContainText('_')
})

test('choose practice marks the right answer', async ({ page }) => {
  await createProfile(page)
  await page.getByRole('link', { name: /Kleuren/ }).click()
  await page.getByRole('link', { name: /Kiezen/ }).click()
  await page.getByRole('button', { name: 'Engels → plaatje' }).click()
  await page.getByRole('button', { name: /Start met/ }).click()
  await expect(page.locator('.option')).toHaveCount(4)
  await page.locator('.option').first().click()
  await expect(page.locator('.option.is-right')).toHaveCount(1)
})

test('a sprint counts down and saves a record', async ({ page }) => {
  await page.clock.install()
  await createProfile(page)
  await page.getByRole('link', { name: /Kleuren/ }).click()
  await page.getByRole('link', { name: /Sprint/ }).click()
  await expect(page.getByText('Nog geen record')).toBeVisible()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.clock')).toHaveText('1:00')
  await page.locator('.option').first().click()
  await page.clock.runFor(61_000)
  await expect(page.getByRole('heading', { name: /goed!|record/i })).toBeVisible()
  await page.getByRole('button', { name: 'Nog een keer' }).isVisible()
})

test('a race goes through every card', async ({ page }) => {
  await createProfile(page)
  await page.getByRole('link', { name: /Kleuren/ }).click()
  await page.getByRole('link', { name: /Race/ }).click()
  await page.getByRole('button', { name: /Go!/ }).click()
  for (let i = 0; i < 11; i++) {
    await answer(page)
    await page.waitForTimeout(450)
  }
  await expect(page.getByRole('heading', { name: /Finish!|Nieuw record!/ })).toBeVisible()
})

test('flip cards turn over and count what you knew', async ({ page }) => {
  await createProfile(page)
  await page.getByRole('link', { name: /Kleuren/ }).click()
  await page.getByRole('link', { name: /Omdraaien/ }).click()
  await page.getByRole('button', { name: /Start met 11 kaarten/ }).click()
  await page.getByRole('button', { name: 'Draai de kaart om' }).click()
  await page.getByRole('button', { name: /Wist ik!/ }).click()
  await expect(page.locator('.session .right')).toHaveText('10')
})

test('the cards page shows every card with both voices', async ({ page }) => {
  await createProfile(page)
  await page.goto(`/#/deck/${deck.id}/cards`)
  await expect(page.locator('.grid .card')).toHaveCount(11)
  await page.getByPlaceholder('Zoeken').fill('rood')
  await expect(page.locator('.grid .card')).toHaveCount(1)
  await page.locator('.grid .card').click()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Juf' })).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Meester' })).toBeVisible()
})

test('deck settings switch templates and set a test date', async ({ page }) => {
  await createProfile(page)
  await page.goto(`/#/deck/${deck.id}/settings`)
  await page.getByText('Luisteren → plaatje').click()
  await page.locator('.chip').first().click()
  await page.getByRole('link', { name: 'Terug' }).click()
  await expect(page.getByText(/Toets op/)).toBeVisible()
  await expect(page.getByText(/Luisteren → plaatje/)).toBeVisible()
})

test('statistics show after practising', async ({ page }) => {
  await createProfile(page)
  await page.goto(`/#/deck/${deck.id}/learn`)
  await finishSession(page)
  await page.goto(`/#/deck/${deck.id}/stats`)
  await expect(
    page
      .getByRole('heading', { name: 'Kaarten die je kent' })
      .or(page.getByText('Kaarten die je kent')),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Moeilijkste woorden' })).toBeVisible()
})

test('the parent area opens straight away and can add a learner', async ({ page }) => {
  await createProfile(page)
  await page.goto('/#/parent')
  await expect(page.getByRole('heading', { name: 'Hoe gaat het?' })).toBeVisible()
  await page.getByRole('button', { name: 'Iemand toevoegen' }).click()
  await page.getByLabel('Naam').fill('Olivier')
  await page.getByRole('button', { name: '🦖' }).click()
  await page.locator('form').getByRole('button', { name: 'Iemand toevoegen' }).click()
  await page.goto('/#/profiles')
  await expect(page.getByRole('button', { name: /Olivier/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Florien/ })).toBeVisible()
})

test('the interface can switch to English', async ({ page }) => {
  await createProfile(page)
  await page.goto('/#/settings')
  await page.getByRole('button', { name: 'English' }).click()
  await page.goto('/#/')
  await expect(page.getByRole('link', { name: /Start learning/ })).toBeVisible()
})

test('undo takes back the last answer in Learn', async ({ page }) => {
  await createProfile(page)
  await page.goto(`/#/deck/${deck.id}/learn`)
  await page.getByRole('button', { name: /Begrepen/ }).click()
  await expect(page.locator('.session .right')).toContainText('20')
  await answer(page, false)
  await expect(page.getByText('Het antwoord is')).toBeVisible()
  await page.getByRole('button', { name: /ongedaan maken/ }).click()
  // The same question again, unanswered, and nothing was logged.
  await expect(page.getByText('Het antwoord is')).not.toBeVisible()
  await expect(page.locator('.option.is-wrong')).toHaveCount(0)
  const log = await page.evaluate(() => {
    const id = localStorage.getItem('flash:current')
    return JSON.parse(localStorage.getItem(`flash:save:${id}`) ?? '{}').log?.length ?? 0
  })
  expect(log).toBe(0)
})

test('the Learn counter and progress bar move on', async ({ page }) => {
  await createProfile(page)
  await page.goto(`/#/deck/${deck.id}/learn`)
  const bar = page.getByRole('progressbar')
  await expect(page.locator('.session .right')).toContainText('20')
  await expect(bar).toHaveAttribute('aria-valuenow', '0')
  await page.getByRole('button', { name: /Begrepen/ }).click()
  await answer(page)
  await page.getByRole('button', { name: /Verder/ }).click()
  // A new card comes back once (its learning step), so the bar moves before the number does.
  await expect(bar).not.toHaveAttribute('aria-valuenow', '0')
  const before = Number(await bar.getAttribute('aria-valuenow'))
  // New cards come back once to be typed; after about as many answers as new cards, the first
  // questions are finished and the number goes down.
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(150)
    if (await page.getByRole('button', { name: /Begrepen/ }).isVisible()) {
      await page.getByRole('button', { name: /Begrepen/ }).click()
      await page.waitForTimeout(150)
    }
    await answer(page)
    await page.getByRole('button', { name: /Verder/ }).click()
  }
  expect(Number(await bar.getAttribute('aria-valuenow'))).toBeGreaterThan(before)
  await expect(page.locator('.session .right')).not.toHaveText('20')
})

test('the options stay in place after a wrong answer', async ({ page }) => {
  await createProfile(page)
  await page.goto(`/#/deck/${deck.id}/practice/listen`)
  await page.getByRole('button', { name: /Start met/ }).click()
  const options = page.locator('.option img')
  await expect(options).toHaveCount(4)
  const before = await options.evaluateAll((imgs) => imgs.map((i) => i.getAttribute('src')))
  // Pick a wrong picture: the clip plays, so find the right one from the card shown afterwards.
  await page.locator('.option').first().click()
  if (
    await page
      .locator('.option.is-right')
      .first()
      .evaluate((el) => el === el.parentElement!.firstElementChild)
  ) {
    // The first was right: go to the next question and pick another one.
    await page.getByRole('button', { name: /Verder/ }).click()
    const next = await options.evaluateAll((imgs) => imgs.map((i) => i.getAttribute('src')))
    await page.locator('.option').nth(1).click()
    await page.waitForTimeout(300)
    expect(await options.evaluateAll((imgs) => imgs.map((i) => i.getAttribute('src')))).toEqual(
      next,
    )
    return
  }
  await page.waitForTimeout(300)
  expect(await options.evaluateAll((imgs) => imgs.map((i) => i.getAttribute('src')))).toEqual(
    before,
  )
})

test('My Home is built in, with its pictures and both voices', async ({ page }) => {
  await createProfile(page)
  await page.getByRole('link', { name: /Stepping Stones Jr\. Thema 1: My Home/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Stepping Stones Jr. Thema 1: My Home' }),
  ).toBeVisible()
  await page.getByRole('link', { name: /30 kaarten/ }).click()
  await expect(page.locator('.grid .card')).toHaveCount(30)
  const loaded = await page
    .locator('.grid .card img')
    .first()
    .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)
  expect(loaded).toBe(true)
  await page.getByPlaceholder('Zoeken').fill('koelkast')
  await page.locator('.grid .card').click()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Juf' })).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Meester' })).toBeVisible()
})
