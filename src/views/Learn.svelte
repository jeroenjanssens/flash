<script lang="ts">
  import { onDestroy } from 'svelte'
  import Icon from '../components/Icon.svelte'
  import Intro from '../components/Intro.svelte'
  import Question from '../components/Question.svelte'
  import SessionBar from '../components/SessionBar.svelte'
  import Summary from '../components/Summary.svelte'
  import type { Card } from '../lib/deck/types'
  import {
    Session,
    answersLeft,
    buildQueue,
    learnMethod,
    recordOf,
    weakest,
    type SessionItem,
  } from '../lib/srs/queue'
  import { applyAnswer } from '../lib/study/apply'
  import type { Answer } from '../lib/study/grade'
  import { levelOf } from '../lib/study/stats'
  import type { ItemRecord } from '../lib/storage/schema'
  import { audio, save } from '../state/app.svelte'
  import { deckById, decks, type LoadedDeck } from '../state/decks.svelte'
  import { t } from '../state/i18n.svelte'
  import { href, navigate, route } from '../state/router.svelte'
  import { pickVoice } from '../state/speak'
  import { session as sessionState } from '../state/ui.svelte'

  /** Learn with spaced repetition: one deck, or every deck (deckIds undefined). */
  let { deckIds }: { deckIds: string[] | undefined } = $props()

  const s = save()
  // ?extra=1: "one more round" (fills up with the weakest words); ?new=5: more new words today.
  const extra = route.query.extra === '1'
  const newBonus = Math.max(0, Math.min(50, Number(route.query.new) || 0))
  const mode = extra ? 'extra' : 'learn'
  const chosen = (() =>
    deckIds ? deckIds.map(deckById).filter((d): d is LoadedDeck => !!d) : decks.list)()
  const session = new Session(
    buildQueue(
      chosen.map((d) => d.deck),
      s,
      Date.now(),
      s.settings.sessionSize,
      { extra, newBonus },
    ),
    (item, repeats) => {
      const progress = s.decks[item.deck.id]
      const record = recordOf(progress, item.card.id, item.template.id)
      return answersLeft(record, repeats, Date.now(), progress?.testDate)
    },
  )
  const size = session.left
  // The session object isn't reactive: mirror what the screen shows.
  let progress = $state(0)
  let done = $state(0)
  let total = $state(session.total)
  const sync = () => ([progress, done, total] = [session.progress, session.done, session.total])

  let current = $state<SessionItem | undefined>(session.current)
  let showIntro = $state(!!session.current?.intro)
  let key = $state(0)
  let right = $state(0)
  let wrong = $state(0)
  let pending: ItemRecord | undefined
  let learned = $state(0)
  const mistakes = new Map<string, { loaded: LoadedDeck; card: Card }>()
  let finished = $state(size === 0)

  sessionState.active = size > 0
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

  /** One step back: the state just before the last answer. */
  interface UndoPoint {
    item: SessionItem
    record: ItemRecord | undefined
    log: number
    session: ReturnType<Session['snapshot']>
    right: number
    wrong: number
    learned: number
    mistakes: [string, { loaded: LoadedDeck; card: Card }][]
  }
  let undoPoint = $state.raw<UndoPoint>()

  function onanswer(answer: Answer) {
    if (!current) return
    const old = recordOf(s.decks[current.deck.id], current.card.id, current.template.id)
    undoPoint = {
      item: current,
      record: old && ($state.snapshot(old) as ItemRecord),
      log: s.log.length,
      session: session.snapshot(),
      right,
      wrong,
      learned,
      mistakes: [...mistakes.entries()],
    }
    const before = levelOf(recordOf(s.decks[current.deck.id], current.card.id, current.template.id))
    pending = applyAnswer(s, current, answer, mode, Date.now())
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
    sync()
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

  function undo() {
    const u = undoPoint
    if (!u) return
    const items = s.decks[u.item.deck.id]?.items[u.item.card.id]
    if (items) {
      if (u.record) items[u.item.template.id] = u.record
      else delete items[u.item.template.id]
    }
    s.log.splice(u.log)
    session.restore(u.session)
    sync()
    ;({ right, wrong, learned } = u)
    mistakes.clear()
    for (const [k, v] of u.mistakes) mistakes.set(k, v)
    pending = undefined
    current = u.item
    showIntro = false
    finished = false
    sessionState.active = true
    undoPoint = undefined
    key++
    audio.sfx('tap')
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'u' && !(e.target instanceof HTMLInputElement) && !e.metaKey && !e.ctrlKey) undo()
  }

  /** Whether another extra round would have something to ask (checked when the session ends). */
  const canExtra = $derived(
    finished &&
      weakest(
        chosen.map((d) => d.deck),
        s,
        Date.now(),
      ).length > 0,
  )
  /** Another extra round (a new query, so the page starts again). */
  const again = $derived(
    href(deckIds?.length === 1 ? `deck/${deckIds[0]}/learn` : 'learn', {
      extra: '1',
      r: String(Date.now()),
    }),
  )

  const back = $derived(deckIds?.length === 1 ? href(`deck/${deckIds[0]}`) : href(''))
</script>

<svelte:window {onkeydown} />

{#if finished}
  <main class="page narrow">
    {#if size === 0}
      <Summary title={extra ? t('extra.nothing') : t('learn.nothing')} stats={[]}>
        {#snippet actions()}
          {#if canExtra}<a class="btn big" href={again}>{t('extra.button')}</a>{/if}
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
          {#if canExtra}<a class="btn big" href={again}>{t('extra.button')}</a>{/if}
          {#if undoPoint}
            <button class="btn big ghost" onclick={undo}
              ><Icon name="undo" />{t('common.undo')}</button
            >
          {/if}
          <a class="btn primary big" href={back}>{t('common.done')}</a>
        {/snippet}
      </Summary>
    {/if}
  </main>
{:else if current && loaded}
  <div class="session" style:--deck={current.deck.color}>
    <SessionBar {progress} onclose={() => navigate(back.slice(2))}>
      {#snippet right()}
        <span class="right-bar">
          {#if undoPoint}
            <button
              class="btn icon ghost"
              onclick={undo}
              aria-label={t('common.undo')}
              title={t('common.undo')}
            >
              <Icon name="undo" />
            </button>
          {/if}
          <span class="count" aria-label={t('session.count', { done, total })}
            >{done} / {total}</span
          >
        </span>
      {/snippet}
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
  .right-bar {
    display: flex;
    align-items: center;
    gap: 4px;
  }
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
