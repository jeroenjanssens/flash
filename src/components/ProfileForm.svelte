<script lang="ts">
  import { AVATARS, COLORS } from '../lib/storage/schema'
  import { t } from '../state/i18n.svelte'

  let {
    name: initialName = '',
    avatar: initialAvatar = AVATARS[0],
    color: initialColor = COLORS[0],
    submitLabel,
    onsubmit,
    oncancel,
  }: {
    name?: string
    avatar?: string
    color?: string
    submitLabel: string
    onsubmit: (p: { name: string; avatar: string; color: string }) => void
    oncancel?: () => void
  } = $props()

  // Start from the given values; the form keeps its own state after that.
  let name = $state((() => initialName)())
  let avatar = $state((() => initialAvatar)())
  let color = $state((() => initialColor)())
</script>

<form
  class="stack"
  onsubmit={(e) => {
    e.preventDefault()
    if (name.trim()) onsubmit({ name: name.trim(), avatar, color })
  }}
>
  <label class="field">
    {t('profiles.name')}
    <input class="input" bind:value={name} maxlength="24" autocomplete="off" required />
  </label>
  <fieldset>
    <legend>{t('profiles.animal')}</legend>
    <div class="choices">
      {#each AVATARS as a (a)}
        <button
          type="button"
          class="choice"
          aria-pressed={avatar === a}
          style:background={avatar === a ? color : undefined}
          onclick={() => (avatar = a)}>{a}</button
        >
      {/each}
    </div>
  </fieldset>
  <fieldset>
    <legend>{t('profiles.color')}</legend>
    <div class="choices">
      {#each COLORS as c (c)}
        <button
          type="button"
          class="swatch"
          aria-pressed={color === c}
          aria-label={c}
          style:background={c}
          onclick={() => (color = c)}
        ></button>
      {/each}
    </div>
  </fieldset>
  <div class="row">
    <button class="btn primary big" type="submit" disabled={!name.trim()}>{submitLabel}</button>
    {#if oncancel}<button class="btn ghost" type="button" onclick={oncancel}
        >{t('common.cancel')}</button
      >{/if}
  </div>
</form>

<style>
  fieldset {
    border: 0;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 8px;
  }
  legend {
    font-weight: 700;
    margin-bottom: 8px;
  }
  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .choice {
    appearance: none;
    border: 0;
    font-size: 30px;
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: var(--surface-2);
    cursor: pointer;
  }
  .choice[aria-pressed='true'] {
    outline: 3px solid var(--ink);
  }
  .swatch {
    appearance: none;
    border: 0;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    cursor: pointer;
  }
  .swatch[aria-pressed='true'] {
    outline: 3px solid var(--ink);
    outline-offset: 3px;
  }
</style>
