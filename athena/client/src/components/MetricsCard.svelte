<script lang="ts">
  import type { Session } from '@typeforge/types';

  interface Props {
    session: Session;
  }

  let { session }: Props = $props();

  const accuracyPercent = $derived((session.accuracy * 100).toFixed(1));
  const durationSec = $derived((session.duration_ms / 1000).toFixed(1));
</script>

<div class="grid grid-cols-4 gap-3 p-3 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-bg-secondary)]">
  <div class="text-center">
    <p class="text-2xl font-bold text-[var(--color-accent-cyan)]">{session.wpm.toFixed(0)}</p>
    <p class="text-xs text-[var(--color-text-secondary)]">WPM</p>
  </div>
  <div class="text-center">
    <p class="text-2xl font-bold text-[var(--color-accent-gold)]">{accuracyPercent}%</p>
    <p class="text-xs text-[var(--color-text-secondary)]">Accuracy</p>
  </div>
  <div class="text-center">
    <p class="text-2xl font-bold text-[var(--color-accent-magenta)]">{session.errors}</p>
    <p class="text-xs text-[var(--color-text-secondary)]">Errors</p>
  </div>
  <div class="text-center">
    <p class="text-2xl font-bold text-[var(--color-text-primary)]">{durationSec}s</p>
    <p class="text-xs text-[var(--color-text-secondary)]">Time</p>
  </div>
</div>
