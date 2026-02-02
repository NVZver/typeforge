<script lang="ts">
  import { onMount } from 'svelte';
  import { sendChat } from './lib/sse-client';
  import type { ActionEvent, ErrorEvent } from '@typeforge/types';

  interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
  }

  let messages: ChatMessage[] = $state([]);
  let input = $state('');
  let streaming = $state('');
  let isLoading = $state(false);
  let lastAction: ActionEvent | null = $state(null);

  const callbacks = {
    onToken(token: string) {
      streaming += token;
    },
    onAction(action: ActionEvent) {
      flushStreaming();
      lastAction = action;
      isLoading = false;
    },
    onDone() {
      flushStreaming();
      isLoading = false;
    },
    onError(err: ErrorEvent) {
      streaming = '';
      messages = [...messages, { role: 'assistant', content: `Error: ${err.message}` }];
      isLoading = false;
    },
  };

  function flushStreaming() {
    if (streaming) {
      messages = [...messages, { role: 'assistant', content: streaming }];
      streaming = '';
    }
  }

  async function sendMessage() {
    const msg = input.trim();
    if (!msg) return;

    messages = [...messages, { role: 'user', content: msg }];
    input = '';
    isLoading = true;
    streaming = '';
    lastAction = null;

    await sendChat({ message: msg }, callbacks);
  }

  async function sendGreeting() {
    isLoading = true;
    streaming = '';
    lastAction = null;
    await sendChat({ trigger: 'greeting' }, callbacks);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  onMount(() => {
    sendGreeting();
  });
</script>

<div class="flex flex-col h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] font-mono">
  <header class="p-4 border-b border-[var(--color-bg-tertiary)]">
    <h1 class="text-[var(--color-accent-cyan)] text-xl">Athena</h1>
  </header>

  <div class="flex-1 overflow-y-auto p-4 space-y-3">
    {#each messages as msg}
      <div class="max-w-2xl {msg.role === 'user' ? 'ml-auto bg-[var(--color-bg-tertiary)]' : 'bg-[var(--color-bg-secondary)]'} rounded-lg p-3">
        <p class="text-xs text-[var(--color-text-secondary)] mb-1">{msg.role === 'user' ? 'You' : 'Athena'}</p>
        <p class="whitespace-pre-wrap">{msg.content}</p>
      </div>
    {/each}

    {#if streaming}
      <div class="max-w-2xl bg-[var(--color-bg-secondary)] rounded-lg p-3">
        <p class="text-xs text-[var(--color-text-secondary)] mb-1">Athena</p>
        <p class="whitespace-pre-wrap">{streaming}<span class="animate-pulse">▊</span></p>
      </div>
    {/if}

    {#if lastAction}
      <div class="max-w-2xl bg-[var(--color-bg-tertiary)] border border-[var(--color-accent-cyan)] rounded-lg p-3">
        <p class="text-xs text-[var(--color-accent-cyan)] mb-1">Action: {lastAction.type}</p>
        <p class="text-sm">{lastAction.text}</p>
      </div>
    {/if}
  </div>

  <div class="p-4 border-t border-[var(--color-bg-tertiary)]">
    <div class="flex gap-2 max-w-2xl mx-auto">
      <input
        type="text"
        bind:value={input}
        onkeydown={handleKeydown}
        placeholder="Talk to Athena..."
        disabled={isLoading}
        class="flex-1 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-tertiary)] rounded px-3 py-2 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-accent-cyan)]"
      />
      <button
        onclick={() => sendMessage()}
        disabled={isLoading || !input.trim()}
        class="bg-[var(--color-accent-cyan)] text-[var(--color-bg-primary)] px-4 py-2 rounded font-bold disabled:opacity-50"
      >
        Send
      </button>
    </div>
  </div>
</div>
