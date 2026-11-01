<script lang="ts">
  import { onDestroy } from 'svelte'
  import Header from '../components/Header.svelte'
  import Icon from '../components/Icon.svelte'
  import Question from '../components/Question.svelte'
  import SessionBar from '../components/SessionBar.svelte'
  import Segmented from '../components/Segmented.svelte'
  import SetupPicker from '../components/SetupPicker.svelte'
  import Summary from '../components/Summary.svelte'
  import { isPictureAnswer } from '../lib/deck/items'
  import type { Card, Method } from '../lib/deck/types'
  import { applyAnswer } from '../lib/study/apply'
  import type { Answer } from '../lib/study/grade'
  import { cardsInSet, type CardSet } from '../lib/study/sets'
  import { bestSprint } from '../lib/study/stats'
  import { audio, save } from '../state/app.svelte'
  import type { LoadedDeck } from '../state/decks.svelte'
  import { formatNumber, formatTime, t } from '../state/i18n.svelte'
  import { href } from '../state/router.svelte'
  import { pickVoice } from '../state/speak'
  import { session } from '../state/ui.svelte'

  /** As many right answers as possible before the time runs out. A wrong answer costs 2 seconds. */
  let { loaded }: { loaded: LoadedDeck } = $props()
  const deck = $derived(loaded.deck)
  const s = save()
  const PENALTY = 2000
  const templates = $derived(deck.templates.filter((x) => x.methods?.some((m) => m !== 'flip')))
  let template = $state((() => templates[0]?.id ?? '')())
  let set = $state<CardSet>('all')
  let minutes = $state(1)
  let method = $state<Method>('choose')
  const tpl = $derived(deck.templates.find((x) => x.id === template))
  const methods = $derived<Method[]>((tpl?.methods ?? []).filter((m) => m !== 'flip'))
  const effective = $derived<Method>(methods.includes(method) ? method : (methods[0] ?? 'choose'))
  const pool = $derived(tpl ? cardsInSet(deck, tpl, 'all', s) : [])
  const best = $derived(
    tpl
      ? bestSprint(s.sprints, { deck: deck.id, template: tpl.id, method: effective, minutes })
      : undefined,
  )

  let phase = $state<'setup' | 'run' | 'done'>('setup')
  let card = $state<Card>()
  let score = $state(0)
  let wrong = $state(0)
  let endsAt = 0
  let left = $state(0)
  let key = $state(0)
  let timer: ReturnType<typeof setInterval> | undefined
  let record = $state(false)
  let previousBest = $state<number>()
  const voice = $derived(pickVoice(deck.voices, s.settings.voice))

  onDestroy(() => {
    clearInterval(timer)
    session.active = false
  })

  function pick() {
    let next = pool[Math.floor(Math.random() * pool.length)]
    if (pool.length > 1) while (next === card) next = pool[Math.floor(Math.random() * pool.length)]
    card = next
    key++
  }

  function start() {
    score = 0
    wrong = 0
    previousBest = best?.score
    record = false
    endsAt = performance.now() + minutes * 60_000
    left = minutes * 60_000
    phase = 'run'
    session.active = true
    pick()
    clearInterval(timer)
    timer = setInterval(() => {
      left = endsAt - performance.now()
      if (left <= 0) finish()
    }, 100)
  }

  function finish() {
    clearInterval(timer)
    if (phase !== 'run') return
    phase = 'done'
    session.active = false
    s.sprints.push({
      t: Date.now(),
      deck: deck.id,
      template: tpl!.id,
      method: effective,
      minutes,
      score,
      wrong,
    })
    record = score > 0 && (previousBest === undefined || score > previousBest)
    audio.sfx(record && previousBest !== undefined ? 'record' : 'done')
  }

  function onanswer(answer: Answer) {
    applyAnswer(s, { deck, card: card!, template: tpl! }, answer, 'sprint', Date.now())
    if (answer.correct) score++
    else {
      wrong++
      endsAt -= PENALTY
    }
  }
</script>

{#if phase === 'setup'}
  <main class="page narrow">
    <Header back={href(`deck/${deck.id}`)} title={t('sprint.title')} />
    <div class="panel stack">
      <p class="muted">{t('sprint.text')}</p>
      <SetupPicker {deck} {templates} bind:template bind:set showSet={false} />
      <div class="row">
        <Segmented
          label={t('sprint.length')}
          bind:value={minutes}
          options={[1, 2, 3, 5].map((m) => ({
            value: m,
            label: t('sprint.minutes', { count: m }),
          }))}
        />
        {#if methods.length > 1 && !(tpl && isPictureAnswer(deck, tpl))}
          <Segmented
            label={t('setup.method')}
            bind:value={method}
            options={methods.map((m) => ({ value: m, label: t(`method.${m}`) }))}
          />
        {/if}
      </div>
      <p class="best">
        <Icon name="trophy" />{best ? t('sprint.best', { score: best.score }) : t('sprint.noBest')}
      </p>
      <button class="btn primary big" onclick={start} disabled={pool.length < 2}>
        <Icon name="stopwatch" />{t('common.start')}
      </button>
    </div>
  </main>
{:else if phase === 'run' && tpl && card}
  <div class="session">
    <SessionBar
      progress={1 - left / (minutes * 60_000)}
      onclose={() => {
        clearInterval(timer)
        phase = 'setup'
        session.active = false
      }}
      color={left < 10_000 ? 'var(--bad)' : undefined}
    >
      {#snippet right()}<span class="clock" class:low={left < 10_000}>{formatTime(left)}</span
        >{/snippet}
    </SessionBar>
    <p class="score" aria-live="polite"><strong>{score}</strong></p>
    <main class="stage">
      {#key key}
        <Question
          {loaded}
          {card}
          template={tpl}
          method={effective}
          {voice}
          quick
          {onanswer}
          onnext={pick}
        />
      {/key}
    </main>
  </div>
{:else}
  <main class="page narrow">
    <Summary
      title={record && previousBest !== undefined
        ? t('sprint.record')
        : t('sprint.done', { score })}
      celebrate={record && previousBest !== undefined}
      stats={[
        { label: t('summary.right'), value: String(score) },
        { label: t('summary.wrong'), value: String(wrong) },
        ...(minutes > 1
          ? [{ label: t('sprint.perMinute'), value: formatNumber(score / minutes, 1) }]
          : []),
        { label: t('sprint.bestLabel'), value: String(Math.max(score, previousBest ?? 0)) },
      ]}
    >
      {#snippet actions()}
        <button class="btn big" onclick={start}>{t('common.again')}</button>
        <a class="btn primary big" href={href(`deck/${deck.id}`)}>{t('common.done')}</a>
      {/snippet}
    </Summary>
  </main>
{/if}

<style>
  .best {
    display: flex;
    gap: 8px;
    align-items: center;
    font-weight: 700;
    color: var(--ink-2);
  }
  .session {
    min-height: 100dvh;
    display: grid;
    grid-template-rows: auto auto 1fr;
  }
  .score {
    text-align: center;
    font-size: 2rem;
    margin: 0;
  }
  .clock {
    font-size: 1.2rem;
  }
  .clock.low {
    color: var(--bad);
  }
  .stage {
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    padding: 4px 20px calc(32px + var(--safe-bottom));
  }
</style>
