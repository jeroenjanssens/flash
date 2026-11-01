<script lang="ts">
  import AudioButton from '../components/AudioButton.svelte'
  import FieldView from '../components/FieldView.svelte'
  import Header from '../components/Header.svelte'
  import Icon from '../components/Icon.svelte'
  import {
    activeTemplates,
    applies,
    deckTags,
    imageField,
    mainTextField,
    translationField,
    textOf,
  } from '../lib/deck/items'
  import type { Card } from '../lib/deck/types'
  import { normalize } from '../lib/study/answer'
  import { cardLevel, levelOf, misspellings, type Level } from '../lib/study/stats'
  import { save } from '../state/app.svelte'
  import type { LoadedDeck } from '../state/decks.svelte'
  import { formatDate, loc, t } from '../state/i18n.svelte'
  import { href } from '../state/router.svelte'
  import { dayKey } from '../lib/time'

  let { loaded }: { loaded: LoadedDeck } = $props()
  const deck = $derived(loaded.deck)
  const s = $derived(save())
  const progress = $derived(s.decks[deck.id])
  const templates = $derived(activeTemplates(deck, progress?.templates))
  const image = $derived(imageField(deck))
  const word = $derived(mainTextField(deck))
  const translation = $derived(translationField(deck))
  const tags = $derived(deckTags(deck))
  const typos = $derived(new Map(misspellings(deck, s.log, 999).map((m) => [m.card.id, m.typed])))

  let filter = $state<'all' | Level | `tag:${string}`>('all')
  let show = $state<'both' | 'pictures' | 'words'>('both')
  let search = $state('')
  let open = $state<Card>()

  const visible = $derived(
    deck.cards.filter((c) => {
      if (
        search &&
        !Object.values(c.fields).some(
          (v) => 'text' in v && normalize(v.text).includes(normalize(search)),
        )
      )
        return false
      if (filter === 'all') return true
      if (filter.startsWith('tag:')) return (c.tags ?? []).includes(filter.slice(4))
      return cardLevel(c, templates, progress) === filter
    }),
  )

  const levelLabel: Record<Level, string> = $derived({
    new: t('level.new'),
    learning: t('level.learning'),
    known: t('level.known'),
    mastered: t('level.mastered'),
  })
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (open = undefined)} />

<main class="page">
  <Header back={href(`deck/${deck.id}`)} title={t('cards.title', { count: deck.cards.length })} />
  <div class="tools">
    <input
      class="input search"
      type="search"
      bind:value={search}
      placeholder={t('cards.search')}
      aria-label={t('cards.search')}
    />
    <div class="segmented" role="group" aria-label={t('cards.show')}>
      {#each [['both', t('cards.both')], ['pictures', t('cards.pictures')], ['words', t('cards.words')]] as [v, label] (v)}
        <button aria-pressed={show === v} onclick={() => (show = v as typeof show)}>{label}</button>
      {/each}
    </div>
  </div>
  <div class="row filters">
    <button class="chip" aria-pressed={filter === 'all'} onclick={() => (filter = 'all')}
      >{t('set.all')}</button
    >
    {#each ['new', 'learning', 'known', 'mastered'] as const as l (l)}
      <button class="chip" aria-pressed={filter === l} onclick={() => (filter = l)}
        >{levelLabel[l]}</button
      >
    {/each}
    {#each tags as tag (tag)}
      <button
        class="chip"
        aria-pressed={filter === `tag:${tag}`}
        onclick={() => (filter = `tag:${tag}`)}>#{tag}</button
      >
    {/each}
  </div>

  <div class="grid">
    {#each visible as card (card.id)}
      {@const level = cardLevel(card, templates, progress)}
      <button class="card panel" onclick={() => (open = card)}>
        <span class="level {level}" title={levelLabel[level]}>
          {#if level === 'mastered'}<Icon name="star" size={18} filled />{:else}{levelLabel[
              level
            ]}{/if}
        </span>
        {#if image && show !== 'words' && card.fields[image]}
          <div class="pic"><FieldView {loaded} {card} field={image} size="small" /></div>
        {/if}
        {#if word && show !== 'pictures'}
          <FieldView {loaded} {card} field={word} size="small" />
        {/if}
        {#if translation && show === 'both' && card.fields[translation]}
          <span class="muted small">{textOf(card, translation)?.text}</span>
        {/if}
      </button>
    {:else}
      <p class="muted">{t('cards.none')}</p>
    {/each}
  </div>
</main>

{#if open}
  {@const card = open}
  <div class="backdrop" role="presentation" onclick={() => (open = undefined)}>
    <div
      class="dialog panel"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={() => {}}
    >
      <button
        class="btn icon ghost close"
        onclick={() => (open = undefined)}
        aria-label={t('common.close')}><Icon name="close" /></button
      >
      {#if image && card.fields[image]}<FieldView {loaded} {card} field={image} size="big" />{/if}
      {#if word}<FieldView {loaded} {card} field={word} size="big" />{/if}
      {#if word && deck.voices?.length}
        <div class="row voices">
          {#each deck.voices as v (v.id)}
            <AudioButton
              {loaded}
              field={word}
              value={textOf(card, word)}
              voice={v}
              label={loc(v.name) || v.id}
            />
          {/each}
        </div>
      {/if}
      {#if translation && card.fields[translation]}<FieldView
          {loaded}
          {card}
          field={translation}
          size="medium"
        />{/if}
      {#if textOf(card, word ?? '')?.accept?.length}
        <p class="muted small">
          {t('cards.alsoRight')}
          {textOf(card, word ?? '')?.accept?.join(', ')}
        </p>
      {/if}
      <table class="templates">
        <tbody>
          {#each deck.templates.filter((tpl) => applies(tpl, card)) as tpl (tpl.id)}
            {@const r = progress?.items[card.id]?.[tpl.id]}
            <tr class:off={!templates.includes(tpl)}>
              <td>{loc(tpl.name) || tpl.id}</td>
              <td><span class="level {levelOf(r)}">{levelLabel[levelOf(r)]}</span></td>
              <td class="muted small"
                >{r && r.state
                  ? t('cards.next', {
                      date: formatDate(dayKey(r.due), { day: 'numeric', month: 'short' }),
                    })
                  : ''}</td
              >
            </tr>
          {/each}
        </tbody>
      </table>
      {#if typos.get(card.id)}
        <p class="muted small">
          {t('cards.typed')}
          {typos
            .get(card.id)!
            .map((x) => `${x.text} (${x.count}×)`)
            .join(', ')}
        </p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .tools {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .search {
    flex: 1;
    min-width: 200px;
  }
  .filters {
    gap: 8px;
    margin-bottom: 18px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 14px;
  }
  .card {
    appearance: none;
    border: 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
    position: relative;
    display: grid;
    gap: 6px;
    justify-items: center;
    align-content: center;
    padding: 18px 12px 14px;
    min-height: 150px;
    transition: transform 0.15s;
  }
  .card:hover {
    transform: translateY(-2px);
  }
  .pic {
    height: 90px;
    display: grid;
    place-items: center;
  }
  .level {
    font-size: 0.72rem;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--ink-3);
  }
  .card .level {
    position: absolute;
    top: 8px;
    right: 8px;
  }
  .level.learning {
    background: var(--warn-soft);
    color: color-mix(in srgb, var(--warn) 70%, var(--ink));
  }
  .level.known {
    background: var(--good-soft);
    color: var(--good);
  }
  .level.mastered {
    background: none;
    color: var(--star);
  }
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgb(20 15 30 / 0.45);
    display: grid;
    place-items: center;
    padding: 20px;
    z-index: 40;
    animation: fade 0.15s ease;
  }
  .dialog {
    position: relative;
    width: min(100%, 520px);
    max-height: 90dvh;
    overflow: auto;
    display: grid;
    gap: 14px;
    justify-items: center;
    padding: 28px 24px;
  }
  .close {
    position: absolute;
    top: 8px;
    right: 8px;
  }
  .voices {
    justify-content: center;
  }
  .templates {
    width: 100%;
    border-collapse: collapse;
  }
  .templates td {
    padding: 6px 4px;
    border-top: 1px solid var(--line);
  }
  .templates tr.off {
    opacity: 0.55;
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
</style>
