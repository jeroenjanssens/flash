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
  import { shuffle } from '../lib/study/options'
  import { cardsInSet, defaultSet, isFixedSet, type CardSet } from '../lib/study/sets'
  import { bestRace } from '../lib/study/stats'
  import { audio, save } from '../state/app.svelte'
  import type { LoadedDeck } from '../state/decks.svelte'
  import { formatTime, t } from '../state/i18n.svelte'
  import { href } from '../state/router.svelte'
  import { pickVoice } from '../state/speak'
  import { session } from '../state/ui.svelte'

  /** Every card of a set once, as fast as possible. A wrong card comes back at the end. */
  let { loaded }: { loaded: LoadedDeck } = $props()
  const deck = $derived(loaded.deck)
  const s = save()
  const templates = $derived(deck.templates.filter((x) => x.methods?.some((m) => m !== 'flip')))
  let template = $state((() => templates[0]?.id ?? '')())
  let set = $state<CardSet>((() => defaultSet(deck, s))())
  let method = $state<Method>('choose')
  const tpl = $derived(deck.templates.find((x) => x.id === template))
  const methods = $derived<Method[]>((tpl?.methods ?? []).filter((m) => m !== 'flip'))
  const effective = $derived<Method>(methods.includes(method) ? method : (methods[0] ?? 'choose'))
  const pool = $derived(tpl ? cardsInSet(deck, tpl, set, s) : [])
  const best = $derived(
    tpl && isFixedSet(set)
      ? bestRace(s.races, { deck: deck.id, set, template: tpl.id, method: effective })
      : undefined,
  )

  let phase = $state<'setup' | 'run' | 'done'>('setup')
  let queue = $state<Card[]>([])
  let index = $state(0)
  let wrong = $state(0)
  let startedAt = 0
  let elapsed = $state(0)
  let timer: ReturnType<typeof setInterval> | undefined
  let key = $state(0)
  let record = $state(false)
  let previousBest = $state<number>()
  const voice = $derived(pickVoice(deck.voices, s.settings.voice))

  onDestroy(() => {
    clearInterval(timer)
    session.active = false
  })

  function start() {
    queue = shuffle(pool)
    index = 0
    wrong = 0
    previousBest = best?.ms
    record = false
    phase = 'run'
    session.active = true
    startedAt = performance.now()
    elapsed = 0
    key++
    clearInterval(timer)
    timer = setInterval(() => (elapsed = performance.now() - startedAt), 100)
  }

  function onanswer(answer: Answer) {
    const card = queue[index]
    applyAnswer(s, { deck, card, template: tpl! }, answer, 'race', Date.now())
    if (!answer.correct) {
      wrong++
      queue = [...queue, card]
    }
  }

  function next() {
    if (index + 1 >= queue.length) {
      clearInterval(timer)
      elapsed = performance.now() - startedAt
      phase = 'done'
      session.active = false
      s.races.push({
        t: Date.now(),
        deck: deck.id,
        set,
        template: tpl!.id,
        method: effective,
        count: pool.length,
        ms: Math.round(elapsed),
        wrong,
      })
      record = isFixedSet(set) && (previousBest === undefined || elapsed < previousBest)
      audio.sfx(record && previousBest !== undefined ? 'record' : 'done')
      return
    }
    index++
    key++
  }
</script>

{#if phase === 'setup'}
  <main class="page narrow">
    <Header back={href(`deck/${deck.id}`)} title={t('race.title')} />
    <div class="panel stack">
      <p class="muted">{t('race.text')}</p>
      <SetupPicker {deck} {templates} bind:template bind:set />
      {#if methods.length > 1 && !(tpl && isPictureAnswer(deck, tpl))}
        <Segmented
          label={t('setup.method')}
          bind:value={method}
          options={methods.map((m) => ({ value: m, label: t(`method.${m}`) }))}
        />
      {/if}
      <p class="best">
        <Icon name="trophy" />{!isFixedSet(set)
          ? t('set.noRecords')
          : best
            ? t('race.best', { time: formatTime(best.ms, true) })
            : t('race.noBest')}
      </p>
      <button class="btn primary big" onclick={start} disabled={!pool.length}>
        <Icon name="flag" />{t('race.start', { count: pool.length })}
      </button>
    </div>
  </main>
{:else if phase === 'run' && tpl}
  <div class="session">
    <SessionBar
      progress={index / queue.length}
      onclose={() => {
        clearInterval(timer)
        phase = 'setup'
        session.active = false
      }}
    >
      {#snippet right()}<span class="clock">{formatTime(elapsed, true)}</span>{/snippet}
    </SessionBar>
    <main class="stage">
      {#key key}
        <Question
          {loaded}
          card={queue[index]}
          template={tpl}
          method={effective}
          {voice}
          quick
          {onanswer}
          onnext={next}
        />
      {/key}
    </main>
  </div>
{:else}
  <main class="page narrow">
    <Summary
      title={record && previousBest !== undefined ? t('race.record') : t('race.done')}
      celebrate={record && previousBest !== undefined}
      stats={[
        { label: t('race.time'), value: formatTime(elapsed, true) },
        { label: t('summary.wrong'), value: String(wrong) },
        ...(isFixedSet(set)
          ? [
              {
                label: t('race.bestLabel'),
                value: formatTime(Math.min(elapsed, previousBest ?? Infinity), true),
              },
            ]
          : []),
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
    grid-template-rows: auto 1fr;
  }
  .clock {
    font-size: 1.2rem;
  }
  .stage {
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    padding: 12px 20px calc(32px + var(--safe-bottom));
  }
</style>
