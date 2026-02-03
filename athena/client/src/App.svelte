<script lang="ts">
  import { onMount } from 'svelte';
  import type { ActionEvent, ErrorEvent, Message } from '@typeforge/types';
  import { sendChat } from './lib/sse-client';
  import { fetchMessages } from './lib/api';
  import {
    getAppState,
    setMessages,
    addMessage,
    prependMessages,
    setIsLoading,
    setTypingText,
    setHasMoreMessages,
    exitTypingView,
    type AppMessage,
  } from './stores/app.svelte';

  import StatusBar from './components/StatusBar.svelte';
  import ChatInput from './components/ChatInput.svelte';
  import RichMessage from './components/RichMessage.svelte';
  import LoadingDots from './components/LoadingDots.svelte';
  import StreamingMessage from './components/StreamingMessage.svelte';

  const appState = getAppState();

  // Use negative IDs for client-created messages to avoid collision with server IDs
  let nextClientId = -1;
  function getNextClientId(): number {
    return nextClientId--;
  }

  let streaming = $state('');
  let messageListEl: HTMLDivElement | undefined = $state();
  let loadMoreTriggerEl: HTMLDivElement | undefined = $state();
  let isLoadingMore = $state(false);
  let initialLoadDone = $state(false);

  const callbacks = {
    onToken(token: string) {
      streaming += token;
    },
    onAction(action: ActionEvent) {
      flushStreaming();
      setTypingText(action.text);
      setIsLoading(false);
    },
    onDone() {
      flushStreaming();
      setIsLoading(false);
    },
    onError(err: ErrorEvent) {
      streaming = '';
      addMessage({
        id: getNextClientId(),
        role: 'assistant',
        content: err.message,
        session_id: null,
        timestamp: Date.now(),
        isError: true,
      });
      setIsLoading(false);
    },
  };

  function flushStreaming() {
    if (streaming) {
      // Strip action markers from saved message
      const content = streaming.replace(/\[ACTION:\w+\][\s\S]*?\[\/ACTION\]/g, '').trim();
      if (content) {
        addMessage({
          id: getNextClientId(),
          role: 'assistant',
          content,
          session_id: null,
          timestamp: Date.now(),
        });
      }
      streaming = '';
    }
  }

  async function handleSend(message: string) {
    addMessage({
      id: getNextClientId(),
      role: 'user',
      content: message,
      session_id: null,
      timestamp: Date.now(),
    });

    setIsLoading(true);
    streaming = '';

    await sendChat({ message }, callbacks);
    scrollToBottom();
  }

  async function sendGreeting() {
    setIsLoading(true);
    streaming = '';
    await sendChat({ trigger: 'greeting' }, callbacks);
    scrollToBottom();
  }

  async function loadInitialMessages() {
    try {
      const { messages, hasMore } = await fetchMessages({ limit: 20 });
      setMessages(messages as AppMessage[]);
      setHasMoreMessages(hasMore);
    } catch {
      // Failed to load messages, start fresh
    }
    initialLoadDone = true;
  }

  async function loadMoreMessages() {
    if (isLoadingMore || !appState.hasMoreMessages || appState.messages.length === 0) return;

    isLoadingMore = true;
    const oldestMessage = appState.messages[0];

    try {
      const { messages, hasMore } = await fetchMessages({
        before: oldestMessage.timestamp,
        limit: 20,
      });
      if (messages.length > 0) {
        prependMessages(messages as AppMessage[]);
      }
      setHasMoreMessages(hasMore);
    } catch {
      // Failed to load more
    }

    isLoadingMore = false;
  }

  function scrollToBottom() {
    setTimeout(() => {
      if (messageListEl) {
        messageListEl.scrollTop = messageListEl.scrollHeight;
      }
    }, 10);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && appState.currentView === 'typing') {
      exitTypingView();
    }
  }

  // Set up IntersectionObserver for scroll-to-load
  $effect(() => {
    if (!loadMoreTriggerEl || !initialLoadDone) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && appState.hasMoreMessages && !isLoadingMore) {
          loadMoreMessages();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreTriggerEl);

    return () => observer.disconnect();
  });

  onMount(async () => {
    await loadInitialMessages();
    // Only send greeting if no existing messages
    if (appState.messages.length === 0) {
      await sendGreeting();
    }
    scrollToBottom();
  });

  const isInputDisabled = $derived(appState.isLoading || appState.connectionStatus === 'error');
</script>

<svelte:window onkeydown={handleKeydown} />

{#if appState.currentView === 'chat'}
  <div class="flex flex-col h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] font-mono">
    <StatusBar />

    <div
      bind:this={messageListEl}
      class="flex-1 overflow-y-auto p-4 space-y-3"
    >
      <!-- Load more trigger at top -->
      {#if appState.hasMoreMessages}
        <div bind:this={loadMoreTriggerEl} class="h-1">
          {#if isLoadingMore}
            <p class="text-center text-xs text-[var(--color-text-secondary)]">Loading...</p>
          {/if}
        </div>
      {/if}

      {#each appState.messages as msg (msg.id)}
        <RichMessage message={msg} />
      {/each}

      {#if appState.isLoading && !streaming}
        <LoadingDots />
      {/if}

      {#if streaming}
        <StreamingMessage content={streaming} />
      {/if}
    </div>

    <ChatInput onSend={handleSend} disabled={isInputDisabled} />
  </div>
{:else if appState.currentView === 'typing' && appState.typingText}
  <div class="fixed inset-0 bg-[var(--color-bg-primary)] flex items-center justify-center p-8">
    <div class="max-w-3xl w-full">
      <div class="mb-8 text-center">
        <p class="text-[var(--color-text-secondary)] text-sm mb-2">Press ESC to exit</p>
        <h2 class="text-[var(--color-accent-cyan)] text-xl">Type the following:</h2>
      </div>
      <div class="bg-[var(--color-bg-secondary)] rounded-lg p-6">
        <p class="text-xl leading-relaxed font-mono">{appState.typingText}</p>
      </div>
      <p class="text-center text-[var(--color-text-secondary)] mt-8 text-sm">
        Typing view coming in Epic 5...
      </p>
    </div>
  </div>
{/if}
