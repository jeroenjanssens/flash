<script lang="ts">
  import { onDestroy } from 'svelte'
  import Intro from '../components/Intro.svelte'
  import Question from '../components/Question.svelte'
  import SessionBar from '../components/SessionBar.svelte'
  import Summary from '../components/Summary.svelte'
  import type { Card } from '../lib/deck/types'
  import { Session, buildQueue, learnMethod, recordOf, type SessionItem } from '../lib/srs/queue'
  import { applyAnswer } from '../lib/study/apply'
  import type { Answer } from '../lib/study/grade'
  import { levelOf } from '../lib/study/stats'
  import type { ItemRecord } from '../lib/storage/schema'
  import { audio, save } from '../state/app.svelte'
  import { deckById, decks, type LoadedDeck } from '../state/decks.svelte'
  import { t } from '../state/i18n.svelte'
  import { href, navigate } from '../state/router.svelte'
  import { pickVoice } from '../state/speak'
  import { session as sessionState } from '../state/ui.svelte'

  /** Learn with spaced repetition: one deck, or every deck (deckIds undefined). */
  let { deckIds }: { deckIds: string[] | undefined } = $props()

  const s = save()
  const chosen = (() =>
    deckIds ? deckIds.map(deckById).filter((d): d is LoadedDeck => !!d) : decks.list)()
  const session = new Session(
    buildQueue(
      chosen.map((d) => d.deck),
      s,
      Date.now(),
      s.settings.sessionSize,
    ),
  )
  const total = session.left

  let current = $state<SessionItem | undefined>(session.current)
  let showIntro = $state(!!session.current?.intro)
  let key = $state(0)
  let right = $state(0)
  let wrong = $state(0)
  let pending: ItemRecord | undefined
  let learned = $state(0)
  const mistakes = new Map<string, { loaded: LoadedDeck; card: Card }>()
  let finished = $state(total === 0)

  sessionState.active = total > 0
  onDestroy(() => (sessionState.active = false))

  const loaded = $derived(current ? deckById(current.deck.id) : undefined)
  const voice = $derived(current ? pickVoice(current.deck.voices, s.settings.voice) : undefined)
  const method = $derived(
    current
      ? learnMethod(
          s.settings.answerStyle,
          current,
          recordOf(s.decks[current.deck.id], current.card.id, current.template.id),
        )
      : 'choose',
  )

  function onanswer(answer: Answer) {
    if (!current) return
    const before = levelOf(recordOf(s.decks[current.deck.id], current.card.id, current.template.id))
    pending = applyAnswer(s, current, answer, 'learn', Date.now())
    if (answer.correct) right++
    else {
      wrong++
      mistakes.set(`${current.deck.id}/${current.card.id}`, { loaded: loaded!, card: current.card })
    }
    if ((before === 'new' || before === 'learning') && pending && levelOf(pending) === 'known')
      learned++
  }

  function next() {
    session.next(pending, Date.now())
    pending = undefined
    current = session.current
    showIntro = !!current?.intro
    key++
    if (!current) {
      finished = true
      sessionState.active = false
      audio.sfx('done')
    }
  }

  const back = $derived(deckIds?.length === 1 ? href(`deck/${deckIds[0]}`) : href(''))
</script>

{#if finished}
  <main class="page narrow">
    {#if total === 0}
      <Summary title={t('learn.nothing')} stats={[]}>
        {#snippet actions()}
          <a class="btn primary big" href={back}>{t('common.done')}</a>
        {/snippet}
      </Summary>
    {:else}
      <Summary
        title={wrong === 0 ? t('summary.perfect') : t('summary.wellDone')}
        celebrate={wrong === 0 && right >= 5}
        stats={[
          { label: t('summary.right'), value: String(right) },
          { label: t('summary.wrong'), value: String(wrong) },
          ...(learned ? [{ label: t('summary.learned'), value: String(learned) }] : []),
        ]}
        mistakes={[...mistakes.values()]}
      >
        {#snippet actions()}
          {#if mistakes.size && deckIds?.length === 1}
            <a
              class="btn big"
              href={href(`deck/${deckIds[0]}/practice/type`, {
                cards: [...mistakes.values()].map((m) => m.card.id).join(','),
              })}>{t('summary.practiseMistakes')}</a
            >
          {/if}
          <a class="btn primary big" href={back}>{t('common.done')}</a>
        {/snippet}
      </Summary>
    {/if}
  </main>
{:else if current && loaded}
  <div class="session" style:--deck={current.deck.color}>
    <SessionBar
      progress={session.done / (session.done + session.left)}
      onclose={() => navigate(back.slice(2))}
    >
      {#snippet right()}{session.left}{/snippet}
    </SessionBar>
    <main class="stage">
      {#key key}
        {#if showIntro}
          <Intro {loaded} card={current.card} {voice} ondone={() => (showIntro = false)} />
        {:else}
          <Question
            {loaded}
            card={current.card}
            template={current.template}
            {method}
            {voice}
            {onanswer}
            onnext={next}
          />
        {/if}
      {/key}
    </main>
  </div>
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
    display: grid;
    align-content: start;
  }
</style>
