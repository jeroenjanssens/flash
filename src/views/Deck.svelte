<script lang="ts">
  import Header from '../components/Header.svelte'
  import Icon, { type IconName } from '../components/Icon.svelte'
  import Ring from '../components/Ring.svelte'
  import { activeTemplates, hasSpokenPrompt } from '../lib/deck/items'
  import { deckCounts, weakest } from '../lib/srs/queue'
  import { cardLevels, deckProgress, readiness } from '../lib/study/stats'
  import { daysUntil } from '../lib/time'
  import { save } from '../state/app.svelte'
  import { mediaUrl, type LoadedDeck } from '../state/decks.svelte'
  import { formatDate, loc, t } from '../state/i18n.svelte'
  import { href } from '../state/router.svelte'
  import type { MessageKey } from '../lib/i18n/en'

  let { loaded }: { loaded: LoadedDeck } = $props()
  const deck = $derived(loaded.deck)
  const s = $derived(save())
  const progress = $derived(s.decks[deck.id])
  const counts = $derived(deckCounts(deck, s, Date.now()))
  const levels = $derived(cardLevels(deck, s))
  const ready = $derived(readiness(deck, s))
  const testIn = $derived(progress?.testDate ? daysUntil(progress.testDate, Date.now()) : undefined)
  const active = $derived(activeTemplates(deck, progress?.templates))
  const canListen = $derived(deck.templates.some(hasSpokenPrompt))
  /** Whether an extra round has something to ask (studied, and not asked in the last hour). */
  const studied = $derived(weakest([deck], s, Date.now()).length > 0)

  const base = $derived(`deck/${deck.id}`)
  const practice = $derived(
    [
      {
        path: 'practice/type',
        icon: 'keyboard',
        title: 'practice.type',
        text: 'practice.typeText',
      },
      {
        path: 'practice/choose',
        icon: 'grid',
        title: 'practice.choose',
        text: 'practice.chooseText',
      },
      canListen && {
        path: 'practice/listen',
        icon: 'ear',
        title: 'practice.listen',
        text: 'practice.listenText',
      },
      { path: 'flip', icon: 'flip', title: 'practice.flip', text: 'practice.flipText' },
      { path: 'sprint', icon: 'stopwatch', title: 'sprint.title', text: 'sprint.text' },
      { path: 'race', icon: 'flag', title: 'race.title', text: 'race.text' },
    ].filter(Boolean) as { path: string; icon: IconName; title: MessageKey; text: MessageKey }[],
  )
</script>

<main class="page">
  <Header back={href('')} />
  <section class="top">
    {#if deck.cover}
      <div class="cover"><img src={mediaUrl(loaded, deck.cover)} alt="" /></div>
    {/if}
    <div class="titles">
      {#if deck.collection}<span class="muted">{loc(deck.collection.title)}</span>{/if}
      <h1>{loc(deck.title)}</h1>
      {#if deck.description}<p class="muted">{loc(deck.description)}</p>{/if}
    </div>
  </section>

  <section class="panel learn">
    <Ring value={deckProgress(levels)} size={92} stroke={10}>
      <span>{Math.round(deckProgress(levels) * 100)}%</span>
    </Ring>
    <div class="learn-text">
      <h2>{t('deck.learn')}</h2>
      <p class="muted">
        {#if counts.due || counts.newCards}
          {t('deck.counts', { due: counts.due, fresh: counts.newCards })}
        {:else if counts.unseen}
          {t('deck.doneToday')}
        {:else}
          {t('deck.allLearned')}
        {/if}
      </p>
      <p class="small muted">{active.map((tpl) => loc(tpl.name) || tpl.id).join(' · ')}</p>
    </div>
    <div class="learn-actions">
      {#if counts.due || counts.newCards}
        <a class="btn primary big" href={href(`${base}/learn`)}>
          <Icon name="play" filled />{t('deck.start')}
        </a>
      {:else if studied}
        <a class="btn primary big" href={href(`${base}/learn`, { extra: '1' })}>
          <Icon name="play" filled />{t('extra.button')}
        </a>
      {/if}
      {#if !counts.newCards && counts.unseen}
        <a class="btn" href={href(`${base}/learn`, { new: '5' })}>
          <Icon name="plus" />{t('extra.moreNew', { count: Math.min(5, counts.unseen) })}
        </a>
      {/if}
    </div>
  </section>

  {#if !counts.due && !counts.newCards && studied && testIn !== undefined && testIn >= 0 && testIn <= 2}
    <a class="nudge panel" href={href(`${base}/learn`, { extra: '1' })}>
      <span aria-hidden="true">💪</span>
      <span>
        <strong>{testIn === 0 ? t('extra.nudgeToday') : t('extra.nudge')}</strong>
        <span class="muted small block">{t('extra.text')}</span>
      </span>
    </a>
  {/if}

  <a class="test panel flat" href={href(`${base}/settings`)}>
    <span class="test-icon" aria-hidden="true">📅</span>
    {#if progress?.testDate && testIn !== undefined && testIn >= 0}
      <div>
        <strong>{t('test.on', { date: formatDate(progress.testDate) })}</strong>
        <p class="muted small">
          {testIn === 0 ? t('test.today') : t('test.inDays', { days: testIn })} ·
          {t('test.ready', { known: ready.known, total: ready.total })}
        </p>
      </div>
    {:else}
      <div>
        <strong>{t('test.set')}</strong>
        <p class="muted small">{t('test.setText')}</p>
      </div>
    {/if}
  </a>

  <h2 class="section">{t('deck.practice')}</h2>
  <div class="practice">
    {#each practice as p (p.path)}
      <a class="mode panel" href={href(`${base}/${p.path}`)}>
        <span class="mode-icon"><Icon name={p.icon} size={30} /></span>
        <strong>{t(p.title)}</strong>
        <span class="muted small">{t(p.text)}</span>
      </a>
    {/each}
  </div>

  <div class="row more">
    <a class="btn" href={href(`${base}/cards`)}
      ><Icon name="cards" />{t('deck.cards', { count: deck.cards.length })}</a
    >
    <a class="btn" href={href(`${base}/stats`)}><Icon name="chart" />{t('nav.stats')}</a>
    <a class="btn" href={href(`${base}/settings`)}><Icon name="gear" />{t('deck.settings')}</a>
  </div>
</main>

<style>
  .top {
    display: flex;
    gap: 20px;
    align-items: center;
    margin-bottom: 20px;
  }
  .cover {
    width: 110px;
    height: 110px;
    flex: none;
    border-radius: 24px;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--accent) 20%, var(--surface));
  }
  .cover img {
    max-width: 84px;
    max-height: 84px;
    border-radius: 10px;
    transform: rotate(-4deg);
    box-shadow: var(--shadow);
    background: white;
  }
  .titles {
    display: grid;
    gap: 4px;
  }
  .learn {
    display: flex;
    gap: 20px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }
  .learn-text {
    flex: 1;
    min-width: 200px;
    display: grid;
    gap: 4px;
  }
  .learn-actions {
    display: grid;
    gap: 8px;
    justify-items: stretch;
  }
  .nudge {
    display: flex;
    gap: 14px;
    align-items: center;
    text-decoration: none;
    margin-bottom: 14px;
    padding: 14px 18px;
    background: var(--warn-soft);
    box-shadow: none;
  }
  .nudge > span:first-child {
    font-size: 28px;
  }
  .block {
    display: block;
  }
  .test {
    display: flex;
    gap: 14px;
    align-items: center;
    text-decoration: none;
    margin-bottom: 28px;
    padding: 14px 18px;
  }
  .test-icon {
    font-size: 28px;
  }
  .section {
    margin-bottom: 12px;
  }
  .practice {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 14px;
    margin-bottom: 28px;
  }
  .mode {
    display: grid;
    gap: 4px;
    text-decoration: none;
    padding: 16px;
    transition: transform 0.15s;
  }
  .mode:hover {
    transform: translateY(-2px);
  }
  .mode-icon {
    width: 52px;
    height: 52px;
    border-radius: 16px;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    color: color-mix(in srgb, var(--accent) 85%, var(--ink));
    margin-bottom: 6px;
  }
  .more {
    justify-content: center;
  }
</style>
