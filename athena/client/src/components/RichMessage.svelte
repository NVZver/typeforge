<script lang="ts">
  import type { AppMessage } from '../stores/app.svelte';
  import type { SessionDetailResponse } from '@typeforge/types';
  import { fetchSessionDetail } from '../lib/api';
  import MetricsCard from './MetricsCard.svelte';
  import KeyboardHeatmap from './KeyboardHeatmap.svelte';
  import ChatMessage from './ChatMessage.svelte';

  interface Props {
    message: AppMessage;
  }

  let { message }: Props = $props();

  let sessionData = $state<SessionDetailResponse | null>(null);
  let loading = $state(false);

  const hasSession = $derived(message.session_id !== null && message.session_id !== undefined);

  $effect(() => {
    if (hasSession && message.session_id) {
      loading = true;
      fetchSessionDetail(message.session_id)
        .then((data) => {
          sessionData = data;
        })
        .catch(() => {
          // Failed to load session, just show plain message
        })
        .finally(() => {
          loading = false;
        });
    }
  });
</script>

{#if hasSession && sessionData}
  <div class="max-w-2xl space-y-2">
    <MetricsCard session={sessionData.session} />
    {#if sessionData.keyStats.length > 0}
      <KeyboardHeatmap keyStats={sessionData.keyStats} />
    {/if}
    <ChatMessage {message} />
  </div>
{:else if hasSession && loading}
  <div class="max-w-2xl bg-[var(--color-bg-secondary)] rounded-lg p-3">
    <p class="text-xs text-[var(--color-text-secondary)]">Loading session data...</p>
  </div>
{:else}
  <ChatMessage {message} />
{/if}
