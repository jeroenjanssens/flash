<script lang="ts">
  import { onDestroy } from 'svelte'
  import Header from '../components/Header.svelte'
  import Icon from '../components/Icon.svelte'
  import Question from '../components/Question.svelte'
  import SessionBar from '../components/SessionBar.svelte'
  import SetupPicker from '../components/SetupPicker.svelte'
  import Summary from '../components/Summary.svelte'
  import { hasSpokenPrompt, templatesWithMethod } from '../lib/deck/items'
  import type { Card, Method } from '../lib/deck/types'
  import { applyAnswer } from '../lib/study/apply'
  import type { Answer } from '../lib/study/grade'
  import { shuffle } from '../lib/study/options'
  import { cardsInSet, defaultSet, type CardSet } from '../lib/study/sets'
  import { audio, save } from '../state/app.svelte'
  import type { LoadedDeck } from '../state/decks.svelte'
  import { t } from '../state/i18n.svelte'
  import { href, route } from '../state/router.svelte'
  import { pickVoice } from '../state/speak'
  import { session } from '../state/ui.svelte'

  /** Practice without touching the schedule: type, choose, or listen. */
  let { loaded, mode }: { loaded: LoadedDeck; mode: 'type' | 'choose' | 'listen' } = $props()

  const deck = $derived(loaded.deck)
  const s = save()
  const method: Method = $derived(mode === 'type' ? 'type' : 'choose')
  const templates = $derived(
    mode === 'listen'
      ? templatesWithMethod(deck, 'choose').filter(hasSpokenPrompt)
      : templatesWithMethod(deck, method).filter((tpl) =>
          mode === 'choose' ? !hasSpokenPrompt(tpl) : true,
        ),
  )
  const list = (route.query.cards ?? '').split(',').filter(Boolean)
  let template = $state((() => templates[0]?.id ?? '')())
  let set = $state<CardSet>((() => (list.length ? 'list' : defaultSet(deck, s)))())
  const tpl = $derived(deck.templates.find((x) => x.id === template))
  const pool = $derived(tpl ? cardsInSet(deck, tpl, set, s, list) : [])

  let phase = $state<'setup' | 'run' | 'done'>('setup')
  let queue = $state<Card[]>([])
  let index = $state(0)
  let right = $state(0)
  let wrongCount = $state(0)
  let repeated = new Set<string>()
  let mistakes = $state<Card[]>([])
  let key = $state(0)
  const voice = $derived(pickVoice(deck.voices, s.settings.voice))

  onDestroy(() => (session.active = false))

  function start() {
    queue = shuffle(pool)
    index = 0
    right = 0
    wrongCount = 0
    repeated = new Set()
    mistakes = []
    phase = 'run'
    session.active = true
    key++
  }

  function onanswer(answer: Answer) {
    const card = queue[index]
    applyAnswer(s, { deck, card, template: tpl! }, answer, mode, Date.now())
    if (answer.correct) right++
    else {
      wrongCount++
      if (!mistakes.includes(card)) mistakes = [...mistakes, card]
      // A wrong card comes back once at the end.
      if (!repeated.has(card.id)) {
        repeated.add(card.id)
        queue = [...queue, card]
      }
    }
  }

  function next() {
    if (index + 1 >= queue.length) {
      phase = 'done'
      session.active = false
      audio.sfx('done')
      return
    }
    index++
    key++
  }

  const titles = {
    type: 'practice.type',
    choose: 'practice.choose',
    listen: 'practice.listen',
  } as const
</script>

{#if phase === 'setup'}
  <main class="page narrow">
    <Header back={href(`deck/${deck.id}`)} title={t(titles[mode])} />
    <div class="panel stack">
      <p class="muted">{t(`practice.${mode}Text`)}</p>
      {#if templates.length}
        <SetupPicker {deck} {templates} bind:template bind:set {list} />
        <button class="btn primary big" onclick={start} disabled={!pool.length}>
          <Icon name="play" filled />{t('practice.start', { count: pool.length })}
        </button>
        <p class="muted small">{t('practice.noSchedule')}</p>
      {:else}
        <p>{t('practice.notAvailable')}</p>
      {/if}
    </div>
  </main>
{:else if phase === 'run' && tpl}
  <div class="session">
    <SessionBar progress={index / queue.length} onclose={() => (phase = 'setup')}>
      {#snippet right()}<span aria-label={t('session.count', { done: index, total: queue.length })}
          >{index} / {queue.length}</span
        >{/snippet}
    </SessionBar>
    <main class="stage">
      {#key key}
        <Question
          {loaded}
          card={queue[index]}
          template={tpl}
          {method}
          {voice}
          {onanswer}
          onnext={next}
        />
      {/key}
    </main>
  </div>
{:else}
  <main class="page narrow">
    <Summary
      title={wrongCount === 0 ? t('summary.perfect') : t('summary.wellDone')}
      celebrate={wrongCount === 0 && right >= 5}
      stats={[
        { label: t('summary.right'), value: String(right) },
        { label: t('summary.wrong'), value: String(wrongCount) },
      ]}
      mistakes={mistakes.map((card) => ({ loaded, card }))}
    >
      {#snippet actions()}
        <button class="btn big" onclick={start}>{t('common.again')}</button>
        <a class="btn primary big" href={href(`deck/${deck.id}`)}>{t('common.done')}</a>
      {/snippet}
    </Summary>
  </main>
{/if}

<style>
  .session {
    min-height: 100dvh;
    display: grid;
    grid-template-rows: auto 1fr;
  }
  .stage {
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    padding: 12px 20px calc(32px + var(--safe-bottom));
  }
</style>
