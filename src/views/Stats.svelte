<script lang="ts">
  import FieldView from '../components/FieldView.svelte'
  import Header from '../components/Header.svelte'
  import Icon from '../components/Icon.svelte'
  import Ring from '../components/Ring.svelte'
  import Forecast from '../components/charts/Forecast.svelte'
  import Heatmap from '../components/charts/Heatmap.svelte'
  import LevelBar from '../components/charts/LevelBar.svelte'
  import { activeTemplates, imageField, mainTextField } from '../lib/deck/items'
  import {
    activityByDay,
    answersToday,
    cardLevels,
    forecast,
    hardest,
    misspellings,
    readiness,
    streak,
    templateLevels,
  } from '../lib/study/stats'
  import { daysUntil } from '../lib/time'
  import { save } from '../state/app.svelte'
  import type { LoadedDeck } from '../state/decks.svelte'
  import { formatDate, formatTime, loc, t } from '../state/i18n.svelte'
  import { href } from '../state/router.svelte'

  let { loaded }: { loaded: LoadedDeck } = $props()
  const deck = $derived(loaded.deck)
  const s = $derived(save())
  const now = Date.now()
  const progress = $derived(s.decks[deck.id])
  const log = $derived(s.log.filter((e) => e.deck === deck.id))
  const levels = $derived(cardLevels(deck, s))
  const ready = $derived(readiness(deck, s))
  const testIn = $derived(progress?.testDate ? daysUntil(progress.testDate, now) : undefined)
  const image = $derived(imageField(deck))
  const word = $derived(mainTextField(deck))
  const accuracy = $derived(log.length ? log.filter((e) => e.correct).length / log.length : 0)

  const sprintRows = $derived.by(() => {
    const best = new Map<string, { label: string; score: number }>()
    for (const sp of s.sprints.filter((x) => x.deck === deck.id)) {
      const tpl = deck.templates.find((x) => x.id === sp.template)
      const key = `${sp.template}|${sp.method}|${sp.minutes}`
      const label = `${loc(tpl?.name) || sp.template} · ${t(`method.${sp.method}`)} · ${t('sprint.minutes', { count: sp.minutes })}`
      if (!best.has(key) || best.get(key)!.score < sp.score)
        best.set(key, { label, score: sp.score })
    }
    return [...best.values()]
  })
  const raceRows = $derived.by(() => {
    const best = new Map<string, { label: string; ms: number }>()
    for (const r of s.races.filter((x) => x.deck === deck.id)) {
      const tpl = deck.templates.find((x) => x.id === r.template)
      const key = `${r.set}|${r.template}|${r.method}`
      const set = r.set === 'all' ? t('set.all') : r.set.replace(/^tag:/, '#')
      const label = `${set} · ${loc(tpl?.name) || r.template} · ${t(`method.${r.method}`)}`
      if (!best.has(key) || best.get(key)!.ms > r.ms) best.set(key, { label, ms: r.ms })
    }
    return [...best.values()]
  })
</script>

<main class="page">
  <Header back={href(`deck/${deck.id}`)} title={t('stats.title', { deck: loc(deck.title) })} />

  <section class="tiles">
    <div class="panel tile">
      <Ring
        value={ready.total ? ready.known / ready.total : 0}
        size={84}
        stroke={10}
        color="var(--good)"
      >
        <span>{ready.known}/{ready.total}</span>
      </Ring>
      <div>
        <strong>{t('stats.known')}</strong>
        {#if progress?.testDate && testIn !== undefined && testIn >= 0}
          <p class="muted small">{t('test.on', { date: formatDate(progress.testDate) })}</p>
        {/if}
      </div>
    </div>
    <div class="panel tile">
      <Icon name="flame" size={40} filled />
      <div>
        <strong>{t('home.streak', { days: streak(s.log, now) })}</strong>
        <p class="muted small">{t('stats.today', { count: answersToday(s.log, now) })}</p>
      </div>
    </div>
    <div class="panel tile">
      <span class="big-number">{Math.round(accuracy * 100)}%</span>
      <div>
        <strong>{t('stats.accuracy')}</strong>
        <p class="muted small">{t('stats.answers', { count: log.length })}</p>
      </div>
    </div>
  </section>

  <section class="panel">
    <h2>{t('stats.cards')}</h2>
    <LevelBar counts={levels} />
    <div class="per-template">
      {#each activeTemplates(deck, progress?.templates) as tpl (tpl.id)}
        <div>
          <h3>{loc(tpl.name) || tpl.id}</h3>
          <LevelBar counts={templateLevels(deck, tpl, progress)} />
        </div>
      {/each}
    </div>
  </section>

  <div class="two">
    <section class="panel">
      <h2>{t('stats.activity')}</h2>
      <Heatmap days={activityByDay(log)} />
    </section>
    <section class="panel">
      <h2>{t('stats.forecast')}</h2>
      <Forecast counts={forecast(deck, s, now)} />
    </section>
  </div>

  <div class="two">
    <section class="panel">
      <div class="spread">
        <h2>{t('stats.hardest')}</h2>
        {#if hardest(deck, log).length}
          <a
            class="btn"
            href={href(`deck/${deck.id}/practice/type`, {
              cards: hardest(deck, log)
                .map((h) => h.card.id)
                .join(','),
            })}><Icon name="keyboard" />{t('stats.practiseHardest')}</a
          >
        {/if}
      </div>
      {#each hardest(deck, log) as h (h.card.id)}
        <div class="trouble">
          {#if image && h.card.fields[image]}<div class="thumb">
              <FieldView {loaded} card={h.card} field={image} size="small" />
            </div>{/if}
          {#if word}<FieldView {loaded} card={h.card} field={word} size="small" withAudio />{/if}
          <span class="muted small">{t('stats.wrongTimes', { count: h.wrong })}</span>
        </div>
      {:else}
        <p class="muted">{t('stats.noMistakes')}</p>
      {/each}
    </section>
    <section class="panel">
      <h2>{t('stats.misspellings')}</h2>
      {#each misspellings(deck, log) as m (m.card.id)}
        <div class="typo">
          <strong class="word">{m.expected}</strong>
          <span class="muted"
            >{m.typed
              .map((x) => (x.count > 1 ? `${x.text} (${x.count}×)` : x.text))
              .join(', ')}</span
          >
        </div>
      {:else}
        <p class="muted">{t('stats.noMisspellings')}</p>
      {/each}
    </section>
  </div>

  <div class="two">
    <section class="panel">
      <h2><Icon name="stopwatch" /> {t('stats.sprints')}</h2>
      {#each sprintRows as r (r.label)}
        <div class="spread rec"><span class="small">{r.label}</span><strong>{r.score}</strong></div>
      {:else}
        <p class="muted">{t('sprint.noBest')}</p>
      {/each}
    </section>
    <section class="panel">
      <h2><Icon name="flag" /> {t('stats.races')}</h2>
      {#each raceRows as r (r.label)}
        <div class="spread rec">
          <span class="small">{r.label}</span><strong>{formatTime(r.ms, true)}</strong>
        </div>
      {:else}
        <p class="muted">{t('race.noBest')}</p>
      {/each}
    </section>
  </div>
</main>

<style>
  main {
    display: grid;
    gap: 16px;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
  }
  .tile {
    display: flex;
    gap: 16px;
    align-items: center;
    color: var(--primary);
  }
  .tile strong {
    color: var(--ink);
  }
  .big-number {
    font-size: 2rem;
    font-weight: 900;
    color: var(--accent);
    min-width: 84px;
    text-align: center;
  }
  section h2 {
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .per-template {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 18px;
    margin-top: 20px;
  }
  .per-template h3 {
    margin-bottom: 8px;
    font-size: 0.95rem;
    color: var(--ink-2);
  }
  .two {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 16px;
  }
  .trouble {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 6px 0;
    border-top: 1px solid var(--line);
  }
  .thumb {
    width: 64px;
    display: grid;
    place-items: center;
  }
  .thumb :global(img) {
    max-height: 48px !important;
  }
  .typo {
    display: grid;
    padding: 6px 0;
    border-top: 1px solid var(--line);
  }
  .rec {
    padding: 8px 0;
    border-top: 1px solid var(--line);
  }
</style>
