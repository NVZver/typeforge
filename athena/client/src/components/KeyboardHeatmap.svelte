<script lang="ts">
  import type { KeyStat } from '@typeforge/types';

  interface Props {
    keyStats: KeyStat[];
  }

  let { keyStats }: Props = $props();

  // Workman keyboard layout
  const rows = [
    ['q', 'd', 'r', 'w', 'b', 'j', 'f', 'u', 'p', ';'],
    ['a', 's', 'h', 't', 'g', 'y', 'n', 'e', 'o', 'i'],
    ['z', 'x', 'm', 'c', 'v', 'k', 'l', ',', '.', '/'],
  ];

  // Build timing map from keyStats
  const timingMap = $derived.by(() => {
    const map = new Map<string, number>();
    for (const stat of keyStats) {
      map.set(stat.key.toLowerCase(), stat.avg_time_ms);
    }
    return map;
  });

  // Find min/max for color scaling and top 3 slowest
  const statsInfo = $derived.by(() => {
    const times = keyStats.map(s => s.avg_time_ms).filter(t => t > 0);
    if (times.length === 0) return { minTime: 0, maxTime: 0, top3Slowest: new Set<string>() };

    const sorted = [...keyStats].sort((a, b) => b.avg_time_ms - a.avg_time_ms);
    const top3 = new Set(sorted.slice(0, 3).map(s => s.key.toLowerCase()));

    return {
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      top3Slowest: top3,
    };
  });

  function getKeyColor(key: string): string {
    const time = timingMap.get(key);
    if (time === undefined) return 'var(--color-bg-tertiary)';

    const { minTime, maxTime } = statsInfo;
    const range = maxTime - minTime;
    if (range === 0) return 'var(--color-success)';

    const ratio = (time - minTime) / range;

    // 5-level color scale: green -> yellow -> orange -> red -> magenta
    if (ratio < 0.2) return 'var(--color-success)';
    if (ratio < 0.4) return '#88ff00';
    if (ratio < 0.6) return 'var(--color-accent-gold)';
    if (ratio < 0.8) return '#ff8800';
    return 'var(--color-accent-magenta)';
  }

  function hasGlow(key: string): boolean {
    return statsInfo.top3Slowest.has(key);
  }
</script>

<div class="p-3 bg-[var(--color-bg-tertiary)] rounded-lg">
  <p class="text-xs text-[var(--color-text-secondary)] mb-2">Key Timing Heatmap</p>

  <div class="flex flex-col gap-1">
    {#each rows as row, rowIndex}
      <div class="flex gap-1 {rowIndex === 1 ? 'ml-2' : rowIndex === 2 ? 'ml-4' : ''}">
        {#each row as key}
          <div
            class="w-8 h-8 flex items-center justify-center rounded text-xs font-mono uppercase"
            style="background-color: {getKeyColor(key)}; {hasGlow(key) ? 'box-shadow: 0 0 8px var(--color-accent-magenta);' : ''}"
          >
            <span class="text-[var(--color-bg-primary)] font-bold">{key}</span>
          </div>
        {/each}
      </div>
    {/each}
  </div>

  <div class="flex justify-between mt-2 text-xs text-[var(--color-text-secondary)]">
    <span>Fast</span>
    <span>Slow</span>
  </div>
</div>
