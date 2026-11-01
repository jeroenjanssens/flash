<script lang="ts">
  import { onDestroy } from 'svelte'
  import FieldView from '../components/FieldView.svelte'
  import Header from '../components/Header.svelte'
  import Icon from '../components/Icon.svelte'
  import SessionBar from '../components/SessionBar.svelte'
  import SetupPicker from '../components/SetupPicker.svelte'
  import Summary from '../components/Summary.svelte'
  import { promptField } from '../lib/deck/parse'
  import type { Card } from '../lib/deck/types'
  import { applyAnswer } from '../lib/study/apply'
  import { shuffle } from '../lib/study/options'
  import { cardsInSet, type CardSet } from '../lib/study/sets'
  import { audio, save, settings } from '../state/app.svelte'
  import type { LoadedDeck } from '../state/decks.svelte'
  import { t } from '../state/i18n.svelte'
  import { href } from '../state/router.svelte'
  import { pickVoice } from '../state/speak'
  import { session } from '../state/ui.svelte'

  /** Paper flashcards: look, flip, and say whether you knew it. Doesn't touch the schedule. */
  let { loaded }: { loaded: LoadedDeck } = $props()
  const deck = $derived(loaded.deck)
  const s = save()
  const templates = $derived(deck.templates)
  let template = $state((() => deck.templates[0]?.id ?? '')())
  let set = $state<CardSet>('all')
  const tpl = $derived(deck.templates.find((x) => x.id === template))
  const pool = $derived(tpl ? cardsInSet(deck, tpl, set, s) : [])
  const voice = $derived(pickVoice(deck.voices, s.settings.voice))

  let phase = $state<'setup' | 'run' | 'done'>('setup')
  let queue = $state<Card[]>([])
  let index = $state(0)
  let flipped = $state(false)
  let known = $state(0)
  let notYet = $state<Card[]>([])
  let started = 0
  let answerView = $state<FieldView>()

  onDestroy(() => (session.active = false))

  function start(cards: Card[]) {
    queue = shuffle(cards)
    index = 0
    known = 0
    notYet = []
    flipped = false
    phase = 'run'
    session.active = true
    started = performance.now()
  }

  function flip() {
    flipped = !flipped
    audio.sfx('flip')
    if (flipped && settings()?.autoplay) setTimeout(() => answerView?.play(), 300)
  }

  function mark(knew: boolean) {
    const card = queue[index]
    applyAnswer(
      s,
      { deck, card, template: tpl! },
      { method: 'flip', correct: knew, hints: 0, ms: performance.now() - started },
      'flip',
      Date.now(),
    )
    if (knew) known++
    else notYet = [...notYet, card]
    audio.sfx(knew ? 'correct' : 'tap')
    if (index + 1 >= queue.length) {
      phase = 'done'
      session.active = false
      audio.sfx('done')
      return
    }
    index++
    flipped = false
    started = performance.now()
  }

  function onkeydown(e: KeyboardEvent) {
    if (phase !== 'run') return
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      flip()
    } else if (flipped && e.key === '1') mark(false)
    else if (flipped && e.key === '2') mark(true)
  }
</script>

<svelte:window {onkeydown} />

{#if phase === 'setup'}
  <main class="page narrow">
    <Header back={href(`deck/${deck.id}`)} title={t('practice.flip')} />
    <div class="panel stack">
      <p class="muted">{t('practice.flipText')}</p>
      <SetupPicker {deck} {templates} bind:template bind:set />
      <button class="btn primary big" onclick={() => start(pool)} disabled={!pool.length}>
        <Icon name="play" filled />{t('practice.start', { count: pool.length })}
      </button>
    </div>
  </main>
{:else if phase === 'run' && tpl}
  {@const card = queue[index]}
  <div class="session">
    <SessionBar progress={index / queue.length} onclose={() => (phase = 'setup')}>
      {#snippet right()}{queue.length - index}{/snippet}
    </SessionBar>
    <main class="stage">
      {#key index}
        <button class="card" class:flipped onclick={flip} aria-label={t('flip.turn')}>
          <div class="side front">
            {#each tpl.prompt as item (promptField(item))}
              <FieldView
                {loaded}
                {card}
                field={promptField(item)}
                as={typeof item === 'string' ? 'text' : (item.as ?? 'text')}
                {voice}
              />
            {/each}
            <span class="tap muted small">{t('flip.tap')}</span>
          </div>
          <div class="side back">
            <FieldView
              bind:this={answerView}
              {loaded}
              {card}
              field={tpl.answer}
              {voice}
              withAudio
            />
            {#each tpl.reveal ?? [] as item (promptField(item))}
              <FieldView {loaded} {card} field={promptField(item)} size="small" />
            {/each}
          </div>
        </button>
      {/key}
      <div class="row marks" class:hidden={!flipped}>
        <button class="btn big notyet" onclick={() => mark(false)} disabled={!flipped}
          >{t('question.notYet')} <kbd>1</kbd></button
        >
        <button class="btn big knew" onclick={() => mark(true)} disabled={!flipped}
          >{t('question.knewIt')} <kbd>2</kbd></button
        >
      </div>
    </main>
  </div>
{:else}
  <main class="page narrow">
    <Summary
      title={notYet.length === 0 ? t('summary.perfect') : t('summary.wellDone')}
      celebrate={notYet.length === 0 && known >= 5}
      stats={[
        { label: t('flip.knew'), value: String(known) },
        { label: t('flip.notYet'), value: String(notYet.length) },
      ]}
      mistakes={notYet.map((card) => ({ loaded, card }))}
    >
      {#snippet actions()}
        {#if notYet.length}<button class="btn big" onclick={() => start(notYet)}
            >{t('flip.again')}</button
          >{/if}
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
    max-width: 640px;
    margin: 0 auto;
    padding: 16px 20px calc(32px + var(--safe-bottom));
    display: grid;
    gap: 24px;
    align-content: start;
    perspective: 1400px;
  }
  .card {
    appearance: none;
    border: 0;
    padding: 0;
    font: inherit;
    color: inherit;
    background: none;
    cursor: pointer;
    position: relative;
    height: min(60vh, 460px);
    transform-style: preserve-3d;
    transition: transform 0.5s cubic-bezier(0.3, 1.3, 0.5, 1);
    animation: deal 0.3s ease;
  }
  .card.flipped {
    transform: rotateY(180deg);
  }
  .side {
    position: absolute;
    inset: 0;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    background: var(--surface);
    border-radius: 28px;
    box-shadow: var(--shadow-lg);
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 16px;
    padding: 24px;
  }
  .back {
    transform: rotateY(180deg);
    background: color-mix(in srgb, var(--accent) 8%, var(--surface));
  }
  .tap {
    position: absolute;
    bottom: 16px;
    left: 0;
    right: 0;
  }
  .marks {
    justify-content: center;
    transition: opacity 0.2s;
  }
  .marks.hidden {
    opacity: 0;
    pointer-events: none;
  }
  .notyet {
    background: var(--bad-soft);
    color: var(--bad);
  }
  .knew {
    background: var(--good-soft);
    color: var(--good);
  }
  @keyframes deal {
    from {
      transform: translateY(20px) rotate(2deg);
      opacity: 0;
    }
  }
</style>
