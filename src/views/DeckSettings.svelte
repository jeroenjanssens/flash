<script lang="ts">
  import Header from '../components/Header.svelte'
  import Icon from '../components/Icon.svelte'
  import { activeTemplates, applies, fieldOf } from '../lib/deck/items'
  import { promptField } from '../lib/deck/parse'
  import type { Template } from '../lib/deck/types'
  import { addDays, dayKey } from '../lib/time'
  import { save } from '../state/app.svelte'
  import type { LoadedDeck } from '../state/decks.svelte'
  import { formatDate, loc, t } from '../state/i18n.svelte'
  import { href } from '../state/router.svelte'

  /** Per learner and deck: which templates are studied, and the test date. */
  let { loaded }: { loaded: LoadedDeck } = $props()
  const deck = $derived(loaded.deck)
  const s = save()

  function progress() {
    return (s.decks[deck.id] ??= { updatedAt: 0, items: {} })
  }

  const active = $derived(activeTemplates(deck, s.decks[deck.id]?.templates).map((x) => x.id))

  function toggle(tpl: Template) {
    const next = active.includes(tpl.id)
      ? active.filter((id) => id !== tpl.id)
      : [...active, tpl.id]
    if (!next.length) return
    const p = progress()
    // Keep the deck's order.
    p.templates = deck.templates.filter((x) => next.includes(x.id)).map((x) => x.id)
    p.updatedAt = Date.now()
  }

  function resetTemplates() {
    const p = progress()
    delete p.templates
    p.updatedAt = Date.now()
  }

  const testDate = $derived(s.decks[deck.id]?.testDate ?? '')
  function setTest(value: string) {
    const p = progress()
    if (value) p.testDate = value
    else delete p.testDate
    p.updatedAt = Date.now()
  }

  const describe = (tpl: Template) => {
    const name = (id: string) => loc(fieldOf(deck, id)?.name) || id
    const prompt = tpl.prompt
      .map((p) =>
        typeof p !== 'string' && p.as === 'audio' ? `🔊 ${name(p.field)}` : name(promptField(p)),
      )
      .join(' + ')
    return `${prompt} → ${name(tpl.answer)}`
  }
</script>

<main class="page narrow">
  <Header back={href(`deck/${deck.id}`)} title={t('deck.settings')} />
  <div class="stack">
    <section class="panel stack">
      <div>
        <h2>{t('templates.title')}</h2>
        <p class="muted">{t('templates.text')}</p>
      </div>
      {#each deck.templates as tpl (tpl.id)}
        {@const count = deck.cards.filter((c) => applies(tpl, c)).length}
        <label class="switch">
          <span>
            <strong>{loc(tpl.name) || tpl.id}</strong>
            <span class="muted small block"
              >{describe(tpl)} · {t('templates.cards', { count })}</span
            >
          </span>
          <input
            type="checkbox"
            checked={active.includes(tpl.id)}
            disabled={active.length === 1 && active.includes(tpl.id)}
            onchange={() => toggle(tpl)}
          />
        </label>
      {/each}
      {#if s.decks[deck.id]?.templates}
        <button class="btn ghost" onclick={resetTemplates}>{t('templates.reset')}</button>
      {/if}
    </section>

    <section class="panel stack">
      <div>
        <h2>📅 {t('test.title')}</h2>
        <p class="muted">{t('test.text')}</p>
      </div>
      <div class="row">
        <input
          class="input date"
          type="date"
          value={testDate}
          min={dayKey(Date.now())}
          onchange={(e) => setTest(e.currentTarget.value)}
          aria-label={t('test.title')}
        />
        {#if testDate}
          <button class="btn ghost" onclick={() => setTest('')}
            ><Icon name="trash" />{t('test.clear')}</button
          >
        {/if}
      </div>
      {#if !testDate}
        <div class="row">
          {#each [1, 3, 4, 7] as d (d)}
            {@const day = addDays(dayKey(Date.now()), d)}
            <button class="chip" onclick={() => setTest(day)}
              >{formatDate(day, { weekday: 'short', day: 'numeric', month: 'short' })}</button
            >
          {/each}
        </div>
      {/if}
    </section>
  </div>
</main>

<style>
  .block {
    display: block;
  }
  .date {
    max-width: 240px;
  }
</style>
