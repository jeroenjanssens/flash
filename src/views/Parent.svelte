<script lang="ts">
  import { renderSVG } from 'uqr'
  import Header from '../components/Header.svelte'
  import Icon from '../components/Icon.svelte'
  import ProfileForm from '../components/ProfileForm.svelte'
  import { parseRepo } from '../lib/deck/library'
  import { mergeFamily } from '../lib/storage/gist'
  import { KEYS, loadProfiles, migrate, migrateProfiles } from '../lib/storage/persistence'
  import type { Profile, ProfileSave } from '../lib/storage/schema'
  import { answersToday, cardLevels, streak } from '../lib/study/stats'
  import {
    createProfile,
    deleteProfile,
    flushSave,
    replaceFamily,
    updateProfile,
    visibleProfiles,
  } from '../state/app.svelte'
  import {
    decks,
    exportZip,
    importZip,
    refreshLibrary,
    removeDeck,
    type LoadedDeck,
  } from '../state/decks.svelte'
  import { loc, t } from '../state/i18n.svelte'
  import { href } from '../state/router.svelte'
  import {
    connect,
    disconnect,
    familySaves,
    pairingLink,
    sync,
    syncNow,
  } from '../state/sync.svelte'
  import { toast } from '../state/ui.svelte'

  const profiles = $derived(visibleProfiles())
  const saves = $derived(familySaves())
  let editing = $state<string>()
  let adding = $state(false)

  let token = $state('')
  let repo = $state(localStorage.getItem(KEYS.deckRepo) ?? '')
  let busy = $state(false)
  let showPair = $state(false)
  const link = $derived(showPair && sync.connected ? pairingLink() : undefined)
  const qr = $derived(link ? renderSVG(link, { border: 2 }) : '')

  async function doConnect(e: Event) {
    e.preventDefault()
    busy = true
    const r = parseRepo(repo)
    const ok = await connect(token, undefined, r)
    busy = false
    toast(ok ? t('sync.connected') : t(`sync.error.${sync.error || 'http'}`), ok ? 'info' : 'error')
    if (ok) token = ''
  }

  async function saveRepo() {
    const r = parseRepo(repo)
    if (!r) {
      localStorage.removeItem(KEYS.deckRepo)
      return
    }
    localStorage.setItem(KEYS.deckRepo, r)
    repo = r
    await refresh()
  }

  async function refresh() {
    busy = true
    try {
      const result = await refreshLibrary()
      if (!result) toast(t('library.notSet'), 'error')
      else if (result.errors.length) toast(result.errors.join('\n'), 'error', 8000)
      else
        toast(
          t('library.refreshed', {
            added: result.added,
            updated: result.updated,
            removed: result.removed,
          }),
        )
    } catch (err) {
      toast(
        t('library.error', { message: err instanceof Error ? err.message : String(err) }),
        'error',
      )
    } finally {
      busy = false
    }
  }

  async function onImport(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      const data = new Uint8Array(await file.arrayBuffer())
      let result = await importZip(data)
      if (result.kind === 'older' && confirm(t('import.older')))
        result = await importZip(data, true)
      if (result.kind !== 'older')
        toast(
          t(result.kind === 'added' ? 'import.added' : 'import.updated', {
            title: loc(result.deck.title),
          }),
        )
    } catch (err) {
      toast(
        t('import.error', { message: err instanceof Error ? err.message : String(err) }),
        'error',
        8000,
      )
    }
  }

  async function onExport(loaded: LoadedDeck) {
    const { blob, name } = await exportZip(loaded)
    download(blob, name)
  }

  function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob)
    const el = Object.assign(document.createElement('a'), { href: url, download: name })
    el.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function backup() {
    flushSave()
    const data = { app: 'flash', version: 1, profiles: loadProfiles(), saves: familySaves() }
    const day = new Date().toISOString().slice(0, 10)
    download(
      new Blob([JSON.stringify(data)], { type: 'application/json' }),
      `flash-backup-${day}.json`,
    )
  }

  async function restore(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      const raw = JSON.parse(await file.text())
      const profiles: Profile[] = migrateProfiles(raw.profiles)
      if (!profiles.length) throw new Error('no profiles')
      const incoming: Record<string, ProfileSave> = {}
      for (const p of profiles)
        if (raw.saves?.[p.id]) incoming[p.id] = migrate(raw.saves[p.id], p.id)
      flushSave()
      const merged = mergeFamily(
        { profiles: loadProfiles(), saves: familySaves() },
        { profiles, saves: incoming },
      )
      replaceFamily(merged.profiles, merged.saves)
      toast(t('backup.restored'))
      if (sync.connected) void syncNow()
    } catch {
      toast(t('backup.error'), 'error')
    }
  }

  function remove(p: Profile) {
    if (confirm(t('profiles.confirmDelete', { name: p.name }))) deleteProfile(p.id)
  }

  const sourceLabel = {
    builtin: 'decks.builtin',
    library: 'decks.library',
    import: 'decks.imported',
  } as const
</script>

<main class="page narrow">
  <Header back={href('')} title={t('nav.parent')} />
  <div class="stack">
    <!-- Overview -->
    {#if profiles.length}
      <section class="panel stack">
        <h2>{t('parent.overview')}</h2>
        {#each profiles as p (p.id)}
          {@const s = saves[p.id]}
          <div class="kid">
            <span class="avatar" style:background={p.color}>{p.avatar}</span>
            <div class="kid-info">
              <strong>{p.name}</strong>
              {#if s}
                <span class="muted small">
                  🔥 {t('home.streak', { days: streak(s.log, Date.now()) })} · {t('stats.today', {
                    count: answersToday(s.log, Date.now()),
                  })}
                </span>
                {#each decks.list as d (d.deck.id)}
                  {@const c = cardLevels(d.deck, s)}
                  {#if c.learning + c.known + c.mastered > 0}
                    <span class="small"
                      >{loc(d.deck.title)}: {t('parent.deckLine', {
                        known: c.known + c.mastered,
                        total: d.deck.cards.length,
                        mastered: c.mastered,
                      })}</span
                    >
                  {/if}
                {/each}
              {/if}
            </div>
          </div>
        {/each}
      </section>
    {/if}

    <!-- Profiles -->
    <section class="panel stack">
      <h2>{t('parent.profiles')}</h2>
      {#each profiles as p (p.id)}
        {#if editing === p.id}
          <ProfileForm
            name={p.name}
            avatar={p.avatar}
            color={p.color}
            submitLabel={t('common.save')}
            onsubmit={(x) => {
              updateProfile(p.id, x)
              editing = undefined
            }}
            oncancel={() => (editing = undefined)}
          />
        {:else}
          <div class="spread">
            <span class="row"
              ><span class="avatar small" style:background={p.color}>{p.avatar}</span><strong
                >{p.name}</strong
              ></span
            >
            <span class="row">
              <button
                class="btn icon ghost"
                onclick={() => (editing = p.id)}
                aria-label={t('common.edit')}><Icon name="edit" /></button
              >
              <button
                class="btn icon ghost danger"
                onclick={() => remove(p)}
                aria-label={t('common.delete')}><Icon name="trash" /></button
              >
            </span>
          </div>
        {/if}
      {/each}
      {#if adding}
        <ProfileForm
          submitLabel={t('profiles.add')}
          onsubmit={(x) => {
            // Adding someone doesn't switch away from who's learning.
            createProfile(x.name, x.avatar, x.color, false)
            adding = false
          }}
          oncancel={() => (adding = false)}
        />
      {:else}
        <button class="btn" onclick={() => (adding = true)}
          ><Icon name="plus" />{t('profiles.add')}</button
        >
      {/if}
    </section>

    <!-- Sync -->
    <section class="panel stack">
      <h2><Icon name="sync" /> {t('sync.title')}</h2>
      {#if sync.connected}
        <p>
          {t('sync.on')}
          {#if sync.lastSync}<span class="muted small"
              >· {t('sync.last', { time: new Date(sync.lastSync).toLocaleString() })}</span
            >{/if}
        </p>
        {#if sync.error}<p class="error">{t(`sync.error.${sync.error}`)}</p>{/if}
        <div class="row">
          <button
            class="btn primary"
            onclick={async () =>
              toast((await syncNow()) ? t('sync.done') : t(`sync.error.${sync.error || 'http'}`))}
            disabled={sync.syncing}
          >
            <Icon name="sync" />{t('sync.now')}
          </button>
          <button class="btn" onclick={() => (showPair = !showPair)}
            ><Icon name="qr" />{t('sync.pair')}</button
          >
          <button
            class="btn ghost danger"
            onclick={() => confirm(t('sync.confirmOff')) && disconnect()}>{t('sync.off')}</button
          >
        </div>
        {#if link}
          <div class="pair">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -- an SVG made by uqr from our own link -->
            <div class="qr">{@html qr}</div>
            <div class="stack">
              <p>{t('sync.pairText')}</p>
              <button
                class="btn"
                onclick={async () => {
                  await navigator.clipboard.writeText(link)
                  toast(t('sync.copied'))
                }}
              >
                <Icon name="link" />{t('sync.copy')}
              </button>
              <p class="muted small">{t('sync.pairWarning')}</p>
            </div>
          </div>
        {/if}
      {:else}
        <p class="muted">{t('sync.intro')}</p>
        <ol class="small steps">
          <!-- eslint-disable-next-line svelte/no-at-html-tags -- our own translation, with a link -->
          <li>{@html t('sync.step1')}</li>
          <li>{t('sync.step2')}</li>
          <li>{t('sync.step3')}</li>
        </ol>
        <form class="stack" onsubmit={doConnect}>
          <label class="field">
            {t('sync.token')}
            <input
              class="input"
              type="password"
              bind:value={token}
              autocomplete="off"
              placeholder="github_pat_…"
              required
            />
          </label>
          <label class="field">
            {t('library.repo')}
            <input
              class="input"
              bind:value={repo}
              placeholder="owner/flash-decks"
              autocomplete="off"
            />
          </label>
          <button class="btn primary" type="submit" disabled={busy || !token.trim()}
            >{t('sync.connect')}</button
          >
        </form>
      {/if}
    </section>

    <!-- Decks -->
    <section class="panel stack">
      <h2><Icon name="cards" /> {t('decks.title')}</h2>
      {#if sync.connected}
        <div class="row">
          <input
            class="input repo"
            bind:value={repo}
            placeholder="owner/flash-decks"
            aria-label={t('library.repo')}
          />
          <button class="btn" onclick={saveRepo} disabled={busy}
            ><Icon name="download" />{t('library.refresh')}</button
          >
        </div>
      {/if}
      {#each decks.list as d (d.deck.id)}
        <div class="spread deck">
          <div>
            <strong>{loc(d.deck.title)}</strong>
            <span class="muted small block">
              {d.deck.collection ? loc(d.deck.collection.title) + ' · ' : ''}{t(
                sourceLabel[d.source],
              )} · {t('decks.revision', { revision: d.deck.revision })} · {t('deck.cards', {
                count: d.deck.cards.length,
              })}
            </span>
          </div>
          <span class="row">
            <button
              class="btn icon ghost"
              onclick={() => onExport(d)}
              aria-label={t('decks.export')}
              title={t('decks.export')}><Icon name="download" /></button
            >
            {#if d.source !== 'builtin'}
              <button
                class="btn icon ghost danger"
                onclick={() =>
                  confirm(t('decks.confirmRemove', { title: loc(d.deck.title) })) &&
                  removeDeck(d.deck.id)}
                aria-label={t('common.delete')}><Icon name="trash" /></button
              >
            {/if}
          </span>
        </div>
      {/each}
      <label class="btn">
        <Icon name="upload" />{t('import.button')}
        <input class="sr-only" type="file" accept=".zip,application/zip" onchange={onImport} />
      </label>
      <p class="muted small">{t('import.text')}</p>
    </section>

    <!-- Backup -->
    <section class="panel stack">
      <h2>{t('backup.title')}</h2>
      <p class="muted small">{t('backup.text')}</p>
      <div class="row">
        <button class="btn" onclick={backup}><Icon name="download" />{t('backup.export')}</button>
        <label class="btn">
          <Icon name="upload" />{t('backup.import')}
          <input class="sr-only" type="file" accept=".json,application/json" onchange={restore} />
        </label>
      </div>
    </section>

    <section class="panel stack small muted">
      <h2>{t('about.title')}</h2>
      <p>{t('about.version', { version: __APP_VERSION__ })}</p>
      <p>{t('about.credits')}</p>
      <p><a href="https://github.com/jeroenjanssens/flash">github.com/jeroenjanssens/flash</a></p>
    </section>
  </div>
</main>

<style>
  .kid {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }
  .kid-info {
    display: grid;
    gap: 2px;
  }
  .avatar {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    font-size: 28px;
    flex: none;
  }
  .avatar.small {
    width: 36px;
    height: 36px;
    font-size: 20px;
    border-radius: 10px;
  }
  .steps {
    margin: 0;
    padding-left: 20px;
    display: grid;
    gap: 6px;
  }
  .pair {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
    align-items: center;
  }
  .qr {
    width: 200px;
    height: 200px;
    background: white;
    border-radius: 12px;
    padding: 8px;
  }
  .qr :global(svg) {
    width: 100%;
    height: 100%;
  }
  .error {
    color: var(--bad);
  }
  .repo {
    flex: 1;
    min-width: 200px;
  }
  .deck {
    padding: 8px 0;
    border-top: 1px solid var(--line);
  }
  .block {
    display: block;
  }
</style>
