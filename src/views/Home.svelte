<script lang="ts">
  import DeckTile from '../components/DeckTile.svelte'
  import Header from '../components/Header.svelte'
  import Icon from '../components/Icon.svelte'
  import Ring from '../components/Ring.svelte'
  import { deckCounts } from '../lib/srs/queue'
  import { answersToday, streak } from '../lib/study/stats'
  import { currentProfile, save } from '../state/app.svelte'
  import { decks, type LoadedDeck } from '../state/decks.svelte'
  import { loc, t } from '../state/i18n.svelte'
  import { href } from '../state/router.svelte'

  const profile = $derived(currentProfile()!)
  const s = $derived(save())
  const now = Date.now()
  const today = $derived(answersToday(s.log, now))
  const days = $derived(streak(s.log, now))
  const goal = $derived(s.settings.dailyGoal)
  const total = $derived(
    decks.list.reduce((sum, d) => {
      const c = deckCounts(d.deck, s, now)
      return sum + c.due + c.newCards
    }, 0),
  )

  /** Decks grouped by collection, in order. */
  const groups = $derived.by(() => {
    const out: { title: string; decks: LoadedDeck[] }[] = []
    for (const d of decks.list) {
      const title = d.deck.collection ? loc(d.deck.collection.title) : t('home.otherDecks')
      const last = out[out.length - 1]
      if (last && last.title === title) last.decks.push(d)
      else out.push({ title, decks: [d] })
    }
    return out
  })

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'home.morning' : hour < 18 ? 'home.afternoon' : 'home.evening'
</script>

<main class="page">
  <Header />
  <section class="hello">
    <div class="who">
      <span class="avatar" style:background={profile.color} aria-hidden="true"
        >{profile.avatar}</span
      >
      <div>
        <h1>{t(greeting, { name: profile.name })}</h1>
        <p class="muted">
          {#if total > 0}{t('home.waiting', { count: total })}{:else if decks.list.length}{t(
              'home.allDone',
            )}{/if}
        </p>
      </div>
    </div>
    <div class="row today">
      <div class="streak" title={t('home.streak', { days })}>
        <Icon name="flame" size={30} filled={days > 0} />
        <strong>{days}</strong>
        <span class="small muted">{t('home.days', { days })}</span>
      </div>
      <Ring value={today / goal} size={72} color="var(--good)">
        <span class="goal">{Math.min(today, 999)}<small>/{goal}</small></span>
      </Ring>
    </div>
  </section>

  {#if decks.list.length && total > 0}
    <a class="btn primary big learn" href={href('learn')}>
      <Icon name="play" filled />{t('home.learn')}
    </a>
  {/if}

  {#if !decks.loaded}
    <div class="loading"></div>
  {:else if !decks.list.length}
    <div class="panel empty">
      <h2>{t('home.noDecks')}</h2>
      <p class="muted">{t('home.noDecksText')}</p>
      <a class="btn" href={href('parent')}><Icon name="lock" />{t('nav.parent')}</a>
    </div>
  {:else}
    {#each groups as group (group.title)}
      <section class="group">
        <h2>{group.title}</h2>
        <div class="decks">
          {#each group.decks as loaded (loaded.deck.id)}
            <DeckTile {loaded} />
          {/each}
        </div>
      </section>
    {/each}
  {/if}
</main>

<style>
  .hello {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
  }
  .who {
    display: flex;
    gap: 16px;
    align-items: center;
  }
  .avatar {
    width: 72px;
    height: 72px;
    border-radius: 22px;
    display: grid;
    place-items: center;
    font-size: 42px;
    box-shadow: var(--shadow);
    flex: none;
  }
  .today {
    gap: 20px;
  }
  .streak {
    display: grid;
    justify-items: center;
    color: var(--primary);
    line-height: 1.1;
  }
  .streak strong {
    font-size: 1.4rem;
    color: var(--ink);
  }
  .goal {
    font-size: 1rem;
  }
  .goal small {
    color: var(--ink-3);
    font-size: 0.7rem;
  }
  .learn {
    width: 100%;
    margin-bottom: 28px;
    font-size: 1.4rem;
    min-height: 72px;
  }
  .group {
    display: grid;
    gap: 14px;
    margin-bottom: 28px;
  }
  .decks {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 18px;
  }
  .empty {
    display: grid;
    gap: 12px;
    justify-items: start;
  }
  .loading {
    min-height: 200px;
  }
</style>
