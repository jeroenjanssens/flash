<script lang="ts">
  import { onMount, tick, untrack } from 'svelte'
  import { fieldOf, isPictureAnswer, langOf, textOf } from '../lib/deck/items'
  import { promptField } from '../lib/deck/parse'
  import type { Card, Method, Template, Voice } from '../lib/deck/types'
  import { MAX_HINT, checkTyped, hintPattern, type DiffPart } from '../lib/study/answer'
  import type { Answer } from '../lib/study/grade'
  import { chooseOptions } from '../lib/study/options'
  import type { Grade } from '../lib/storage/schema'
  import { audio, settings } from '../state/app.svelte'
  import type { LoadedDeck } from '../state/decks.svelte'
  import { t } from '../state/i18n.svelte'
  import { preload } from '../state/speak'
  import FieldView from './FieldView.svelte'
  import Icon from './Icon.svelte'

  let {
    loaded,
    card,
    template,
    method,
    voice,
    quick = false,
    extraCards = [],
    onanswer,
    onnext,
  }: {
    loaded: LoadedDeck
    card: Card
    template: Template
    method: Method
    voice?: Voice
    /** Sprint and race: no hints, no second try, and straight on to the next question. */
    quick?: boolean
    extraCards?: Card[]
    onanswer: (answer: Answer) => void
    onnext: () => void
  } = $props()

  const deck = $derived(loaded.deck)
  const answerField = $derived(template.answer)
  const answerValue = $derived(textOf(card, answerField))
  const pictureAnswer = $derived(isPictureAnswer(deck, template))
  const spokenPrompt = $derived(
    template.prompt.find((p) => typeof p !== 'string' && p.as === 'audio'),
  )
  /** The text to say after answering: the answer if it's spoken, else a spoken prompt or reveal field. */
  const sayField = $derived.by(() => {
    const ids = [
      answerField,
      ...template.prompt.map(promptField),
      ...(template.reveal ?? []).map(promptField),
    ]
    return ids.find((id) => fieldOf(deck, id)?.speak && textOf(card, id))
  })

  type Phase = 'ask' | 'close' | 'shown' | 'done'
  let phase = $state<Phase>('ask')
  let typed = $state('')
  let hints = $state(0)
  let correct = $state(false)
  let chosen = $state<string>()
  let diff = $state<DiffPart[]>([])
  let closeDiff = $state<DiffPart[]>([])
  let started = performance.now()
  let input = $state<HTMLInputElement>()
  let promptViews = $state<FieldView[]>([])
  let sayButton = $state<FieldView>()

  // Drawn once per question: the options must stay where they are after answering, even when
  // the page around the question changes (e.g. a wrong card is added to the end of the queue).
  const options = untrack(() =>
    method === 'choose' ? chooseOptions(deck, card, template, 4, Math.random, extraCards) : [],
  )

  onMount(() => {
    started = performance.now()
    if (sayField) preload(loaded, textOf(card, sayField), voice)
    if (spokenPrompt)
      void tick().then(() => promptViews[template.prompt.indexOf(spokenPrompt)]?.play())
    if (method === 'type') void tick().then(() => input?.focus())
  })

  function finish(isCorrect: boolean, extra: Partial<Answer> = {}) {
    correct = isCorrect
    phase = 'done'
    audio.sfx(isCorrect ? 'correct' : 'wrong')
    onanswer({ method, correct: isCorrect, hints, ms: performance.now() - started, ...extra })
    if (quick) {
      setTimeout(onnext, isCorrect ? 350 : 1300)
      return
    }
    if (settings()?.autoplay && sayField) void tick().then(() => sayButton?.play())
  }

  function check() {
    if (phase !== 'ask' && phase !== 'close') return
    if (!answerValue || !typed.trim()) return
    const result = checkTyped(typed, answerValue)
    if (result.verdict === 'correct') {
      finish(true, phase === 'close' ? { corrected: true } : {})
    } else if (result.verdict === 'close' && phase === 'ask' && !quick) {
      phase = 'close'
      closeDiff = result.diff
      audio.sfx('close')
      void tick().then(() => input?.select())
    } else {
      diff = result.diff
      finish(false, { answered: typed })
    }
  }

  function giveUp() {
    diff = []
    finish(false, { answered: typed || undefined })
  }

  function choose(option: Card) {
    if (phase !== 'ask') return
    chosen = option.id
    if (option.id === card.id) finish(true)
    else {
      const text = textOf(option, answerField)?.text
      finish(false, { answered: text ?? option.id })
    }
  }

  function hint() {
    if (hints < MAX_HINT) hints++
    audio.sfx('tap')
    input?.focus()
  }

  function show() {
    phase = 'shown'
    audio.sfx('flip')
    if (settings()?.autoplay && sayField) void tick().then(() => sayButton?.play())
  }

  function selfGrade(grade: Grade) {
    onanswer({
      method: 'flip',
      correct: grade > 1,
      hints: 0,
      ms: performance.now() - started,
      selfGrade: grade,
    })
    onnext()
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const typing = e.target instanceof HTMLInputElement
    if (phase === 'done' && !quick && (e.key === 'Enter' || (e.key === ' ' && !typing))) {
      e.preventDefault()
      onnext()
    } else if (method === 'choose' && phase === 'ask' && /^[1-4]$/.test(e.key)) {
      const o = options[Number(e.key) - 1]
      if (o) choose(o)
    } else if (method === 'flip' && phase === 'ask' && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault()
      show()
    } else if (method === 'flip' && phase === 'shown' && ['1', '2', '3'].includes(e.key)) {
      selfGrade(([1, 3, 4] as Grade[])[Number(e.key) - 1])
    }
  }
</script>

<svelte:window {onkeydown} />

<div
  class="question"
  class:done={phase === 'done'}
  class:right={phase === 'done' && correct}
  class:wrong={phase === 'done' && !correct}
>
  <div class="prompt">
    {#each template.prompt as item, i (i)}
      <FieldView
        bind:this={promptViews[i]}
        {loaded}
        {card}
        field={promptField(item)}
        as={typeof item === 'string' ? 'text' : (item.as ?? 'text')}
        {voice}
        size="big"
      />
    {/each}
  </div>

  {#if method === 'type'}
    <form
      class="type"
      onsubmit={(e) => {
        e.preventDefault()
        if (phase === 'done') {
          if (!quick) onnext()
        } else check()
      }}
    >
      {#if hints > 0 && phase !== 'done' && answerValue}
        <p class="hint word" aria-live="polite">{hintPattern(answerValue.text, hints)}</p>
      {/if}
      {#if phase === 'close'}
        <p class="close-msg" aria-live="polite">
          <strong>{t('question.almost')}</strong>
          <span class="diff word">
            {#each closeDiff as part, i (i)}<span class={part.kind}
                >{part.kind === 'missing' ? '·' : part.text}</span
              >{/each}
          </span>
        </p>
      {/if}
      <div class="type-row">
        <input
          bind:this={input}
          bind:value={typed}
          class="input word answer-input"
          class:is-close={phase === 'close'}
          type="text"
          lang={langOf(deck, answerField, answerValue)}
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          enterkeyhint="done"
          readonly={phase === 'done'}
          aria-label={t('question.typeHere')}
          placeholder={t('question.typeHere')}
        />
        {#if phase !== 'done'}
          <button class="btn primary" type="submit" disabled={!typed.trim()}>
            <Icon name="check" />{t('question.check')}
          </button>
        {/if}
      </div>
      {#if phase !== 'done' && !quick}
        <div class="row helpers">
          <button type="button" class="btn ghost" onclick={hint} disabled={hints >= MAX_HINT}>
            <Icon name="bulb" />{t('question.hint')}
          </button>
          <button type="button" class="btn ghost" onclick={giveUp}>{t('question.dontKnow')}</button>
        </div>
      {/if}
    </form>
  {:else if method === 'choose'}
    <div
      class="options"
      class:pictures={pictureAnswer}
      role="group"
      aria-label={t('question.choose')}
    >
      {#each options as option, i (option.id)}
        <button
          type="button"
          class="option"
          class:is-right={phase === 'done' && option.id === card.id}
          class:is-wrong={phase === 'done' && option.id === chosen && option.id !== card.id}
          class:faded={phase === 'done' && option.id !== card.id && option.id !== chosen}
          disabled={phase === 'done'}
          onclick={() => choose(option)}
        >
          {#if pictureAnswer}
            <FieldView {loaded} card={option} field={answerField} size="medium" />
          {:else}
            <FieldView {loaded} card={option} field={answerField} size="medium" />
          {/if}
          <kbd>{i + 1}</kbd>
        </button>
      {/each}
    </div>
  {:else if method === 'flip' && phase === 'ask'}
    <button class="btn big primary show" onclick={show}>{t('question.show')} <kbd>␣</kbd></button>
  {/if}

  {#if phase === 'done' || phase === 'shown'}
    <div class="reveal" aria-live="polite">
      {#if phase === 'done' && method === 'type' && !correct}
        {#if diff.length}
          <p class="you-typed">
            {t('question.youTyped')}
            <span class="diff word">
              {#each diff as part, i (i)}<span class={part.kind}
                  >{part.kind === 'missing' ? '·' : part.text}</span
                >{/each}
            </span>
          </p>
        {/if}
      {/if}
      {#if phase === 'done'}
        <p class="verdict">
          {#if correct}<Icon name="check" size={28} />{t('question.right')}{:else}{t(
              'question.answerIs',
            )}{/if}
        </p>
      {/if}
      {#if !(method === 'choose' && pictureAnswer)}
        <FieldView
          bind:this={sayButton}
          {loaded}
          {card}
          field={answerField}
          {voice}
          size={pictureAnswer ? 'medium' : 'big'}
          withAudio={!quick}
        />
      {:else if sayField && !quick}
        <FieldView
          bind:this={sayButton}
          {loaded}
          {card}
          field={sayField}
          {voice}
          size="medium"
          withAudio
        />
      {/if}
      {#if !quick}
        <div class="extra">
          {#each template.reveal ?? [] as item (promptField(item))}
            {#if promptField(item) !== sayField || !(method === 'choose' && pictureAnswer)}
              <FieldView {loaded} {card} field={promptField(item)} size="small" {voice} />
            {/if}
          {/each}
        </div>
      {/if}
      {#if phase === 'done' && !quick}
        <button class="btn big primary next" onclick={onnext}>
          {t('question.next')}<Icon name="next" /> <kbd>↵</kbd>
        </button>
      {/if}
      {#if phase === 'shown'}
        <p class="muted">{t('question.didYouKnow')}</p>
        <div class="row grades">
          <button class="btn big notyet" onclick={() => selfGrade(1)}
            >{t('question.notYet')} <kbd>1</kbd></button
          >
          <button class="btn big good" onclick={() => selfGrade(3)}
            >{t('question.knewIt')} <kbd>2</kbd></button
          >
          <button class="btn big easy" onclick={() => selfGrade(4)}
            >{t('question.easy')} <kbd>3</kbd></button
          >
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .question {
    background: var(--surface);
    border-radius: 28px;
    box-shadow: var(--shadow-lg);
    padding: clamp(20px, 4vw, 36px) clamp(16px, 4vw, 40px);
    display: grid;
    gap: 20px;
    justify-items: center;
    width: 100%;
  }
  .prompt {
    display: grid;
    gap: 12px;
    justify-items: center;
    min-height: 120px;
    align-content: center;
    width: 100%;
  }
  .type {
    display: grid;
    gap: 10px;
    width: min(100%, 520px);
    justify-items: center;
  }
  .type-row {
    display: flex;
    gap: 10px;
    width: 100%;
  }
  .answer-input {
    font-size: 1.6rem;
    min-height: 60px;
    text-align: center;
    border-width: 3px;
  }
  .right .answer-input {
    border-color: var(--good);
    background: var(--good-soft);
  }
  .wrong .answer-input {
    border-color: var(--bad);
    background: var(--bad-soft);
    text-decoration: line-through;
    text-decoration-thickness: 2px;
  }
  .answer-input.is-close {
    border-color: var(--warn);
  }
  .hint {
    font-size: 1.6rem;
    letter-spacing: 0.06em;
    color: var(--ink-2);
    white-space: pre;
  }
  .close-msg {
    display: flex;
    gap: 10px;
    align-items: baseline;
    background: var(--warn-soft);
    padding: 8px 16px;
    border-radius: 999px;
  }
  .diff {
    font-size: 1.3rem;
    letter-spacing: 0.02em;
  }
  .diff .wrong,
  .diff .extra {
    color: var(--bad);
    text-decoration: underline wavy;
    text-underline-offset: 4px;
  }
  .diff .missing {
    color: var(--bad);
    font-weight: 900;
  }
  .helpers {
    justify-content: center;
  }
  .options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    width: min(100%, 560px);
  }
  .option {
    appearance: none;
    font: inherit;
    color: inherit;
    position: relative;
    border: 3px solid var(--line);
    background: var(--surface);
    border-radius: var(--radius);
    min-height: 76px;
    padding: 12px;
    cursor: pointer;
    display: grid;
    place-items: center;
    transition:
      transform 0.12s,
      border-color 0.15s,
      opacity 0.2s;
  }
  .options.pictures .option {
    min-height: 150px;
  }
  .option:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .option:active:not(:disabled) {
    transform: scale(0.97);
  }
  .option kbd {
    position: absolute;
    top: 6px;
    left: 8px;
  }
  .option.is-right {
    border-color: var(--good);
    background: var(--good-soft);
    animation: pop 0.3s ease;
  }
  .option.is-wrong {
    border-color: var(--bad);
    background: var(--bad-soft);
    animation: shake 0.35s ease;
  }
  .option.faded {
    opacity: 0.35;
  }
  .option:disabled {
    cursor: default;
  }
  .reveal {
    display: grid;
    gap: 12px;
    justify-items: center;
    animation: rise 0.25s ease;
    width: 100%;
  }
  .verdict {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 800;
    font-size: 1.2rem;
  }
  .right .verdict {
    color: var(--good);
  }
  .wrong .verdict {
    color: var(--bad);
  }
  .you-typed {
    color: var(--ink-2);
    display: flex;
    gap: 8px;
    align-items: baseline;
  }
  .extra {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    color: var(--ink-2);
  }
  .next {
    margin-top: 8px;
    min-width: 200px;
  }
  .show {
    min-width: 240px;
  }
  .grades {
    justify-content: center;
  }
  .grades .notyet {
    background: var(--bad-soft);
    color: var(--bad);
  }
  .grades .good {
    background: var(--good-soft);
    color: var(--good);
  }
  .grades .easy {
    background: color-mix(in srgb, var(--accent) 16%, transparent);
  }
  @keyframes pop {
    50% {
      transform: scale(1.04);
    }
  }
  @keyframes shake {
    25% {
      transform: translateX(-6px);
    }
    75% {
      transform: translateX(6px);
    }
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }
  @media (max-width: 520px) {
    .type-row {
      flex-direction: column;
    }
    .type-row .btn {
      width: 100%;
    }
  }
</style>
