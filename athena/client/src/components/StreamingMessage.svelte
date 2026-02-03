<script lang="ts">
  interface Props {
    content: string;
  }

  let { content }: Props = $props();

  // Strip action markers from display
  const displayContent = $derived(
    content.replace(/\[ACTION:\w+\][\s\S]*?\[\/ACTION\]/g, '').trim()
  );
</script>

<div class="max-w-2xl bg-[var(--color-bg-secondary)] rounded-lg p-3">
  <p class="text-xs text-[var(--color-text-secondary)] mb-1">Athena</p>
  <p class="whitespace-pre-wrap">{displayContent}<span class="animate-pulse text-[var(--color-accent-cyan)]">|</span></p>
</div>
