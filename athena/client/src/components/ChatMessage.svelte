<script lang="ts">
  import type { AppMessage } from '../stores/app.svelte';

  interface Props {
    message: AppMessage;
  }

  let { message }: Props = $props();

  const isUser = $derived(message.role === 'user');
  const isError = $derived(message.isError ?? false);
</script>

<div
  class="max-w-2xl rounded-lg p-3 {isUser ? 'ml-auto bg-[var(--color-bg-tertiary)]' : 'bg-[var(--color-bg-secondary)]'} {isError ? 'border border-[var(--color-error)]' : ''}"
>
  <p class="text-xs mb-1 {isError ? 'text-[var(--color-error)]' : 'text-[var(--color-text-secondary)]'}">
    {isUser ? 'You' : 'Athena'}
  </p>
  <p class="whitespace-pre-wrap">{message.content}</p>
</div>
