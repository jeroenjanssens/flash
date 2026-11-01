<script lang="ts" module>
  const PATHS = {
    home: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5M10 20v-5h4v5',
    gear: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-2.1.9 1.6-1.9 3.2-1.8-.3a7 7 0 0 1-1.7 1l-.6 1.7h-3.7l-.6-1.7a7 7 0 0 1-1.7-1l-1.8.3L3.6 15l.9-1.6a7 7 0 0 1 0-2l-.9-1.6 1.9-3.2 1.8.3a7 7 0 0 1 1.7-1l.6-1.7h3.7l.6 1.7a7 7 0 0 1 1.7 1l1.8-.3 1.9 3.2-.9 1.6a7 7 0 0 1 0 2Z',
    close: 'M6 6l12 12M18 6 6 18',
    back: 'M15 5l-7 7 7 7',
    next: 'M9 5l7 7-7 7',
    speaker: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    x: 'M7 7l10 10M17 7 7 17',
    bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3Z',
    stopwatch: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 9v4l2.5 2M10 2h4M19 6l1.5-1.5',
    flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
    cards: 'M7 6.5 15.5 4l4 13.5L11 20zM4.5 8.5l2.4 9.2',
    chart: 'M4 20h16M7 16v-5M12 16V7M17 16v-8',
    keyboard: 'M3 7h18v11H3zM7 11h.01M11 11h.01M15 11h.01M7 14.5h10',
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    ear: 'M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-5.5 1.6M10 9.5a2 2 0 0 1 4 0',
    flip: 'M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4',
    sync: 'M4 12a8 8 0 0 1 14-5.3L20 9M20 12a8 8 0 0 1-14 5.3L4 15M20 4v5h-5M4 20v-5h5',
    plus: 'M12 5v14M5 12h14',
    trash: 'M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
    upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
    star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
    flame:
      'M12 21c3.9 0 6.5-2.6 6.5-6.2 0-3.6-2.7-5.4-3.8-8.8-1.8 1.6-2.4 3.4-2.3 5-1.4-.8-2.4-2.5-2.4-4.5-2.6 2-4.5 5-4.5 8.3C5.5 18.4 8.1 21 12 21Z',
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0',
    lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
    play: 'M8 5.5v13l10-6.5z',
    shuffle:
      'M4 7h3c4 0 6 10 10 10h3M4 17h3c1.6 0 2.8-1.6 3.9-3.6M13.2 9.6C14.2 8 15.4 7 17 7h3M18 4l3 3-3 3M18 14l3 3-3 3',
    undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
    link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
    qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2',
    edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
    trophy:
      'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M9 17h6',
  } as const
  export type IconName = keyof typeof PATHS
</script>

<script lang="ts">
  let {
    name,
    size = 24,
    filled = false,
  }: { name: IconName; size?: number; filled?: boolean } = $props()
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill={filled ? 'currentColor' : 'none'}
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d={PATHS[name]} />
</svg>
