<script lang="ts">
  interface Props {
    text?: string;
  }

  let { text = 'Athena is thinking' }: Props = $props();
</script>

<div class="max-w-2xl bg-[var(--color-bg-secondary)] rounded-lg p-3">
  <p class="text-xs text-[var(--color-text-secondary)] mb-1">Athena</p>
  <p class="text-[var(--color-text-secondary)]">
    {text}
    <span class="loading-dots">
      <span class="dot">.</span>
      <span class="dot">.</span>
      <span class="dot">.</span>
    </span>
  </p>
</div>

<style>
  .loading-dots .dot {
    animation: pulse 1.4s infinite;
    opacity: 0;
  }

  .loading-dots .dot:nth-child(1) {
    animation-delay: 0s;
  }

  .loading-dots .dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .loading-dots .dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes pulse {
    0%, 80%, 100% {
      opacity: 0;
    }
    40% {
      opacity: 1;
    }
  }
</style>
