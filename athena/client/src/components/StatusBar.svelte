<script lang="ts">
  import { fetchHealth } from '../lib/api';
  import { getAppState, setConnectionStatus } from '../stores/app.svelte';

  const appState = getAppState();
  let modelName: string | null = $state(null);

  async function checkHealth() {
    try {
      const health = await fetchHealth();
      setConnectionStatus(health.status);
      modelName = health.model;
    } catch {
      setConnectionStatus('error');
      modelName = null;
    }
  }

  $effect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  });

  const isConnected = $derived(appState.connectionStatus === 'connected');
  const isError = $derived(appState.connectionStatus === 'error');
</script>

<header class="flex items-center justify-between p-4 border-b border-[var(--color-bg-tertiary)]">
  <h1 class="text-[var(--color-accent-cyan)] text-xl font-bold">Athena</h1>

  <div class="flex items-center gap-2 text-sm">
    <span
      class="w-2 h-2 rounded-full {isConnected ? 'bg-[var(--color-success)]' : isError ? 'bg-[var(--color-error)]' : 'bg-[var(--color-text-secondary)]'}"
    ></span>
    <span class="text-[var(--color-text-secondary)]">
      {#if isConnected && modelName}
        {modelName}
      {:else if isError}
        Offline
      {:else}
        Connecting...
      {/if}
    </span>
  </div>
</header>

{#if isError}
  <div class="bg-[var(--color-error)] bg-opacity-20 border-b border-[var(--color-error)] px-4 py-2 text-center text-sm">
    <span class="text-[var(--color-error)]">Athena is offline — LMStudio is not running.</span>
  </div>
{/if}
