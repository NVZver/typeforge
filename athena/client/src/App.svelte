<script lang="ts">
  import type { ActionEvent, ErrorEvent, Message, SessionData } from '@typeforge/types';
  import { sendChat } from './lib/sse-client';
  import { fetchMessages, saveSession } from './lib/api';
  import type { TypingMetrics, KeyStats } from './lib/typing-engine';
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
  import TypingView from './components/TypingView.svelte';

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
  let initialLoadStarted = $state(false);

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
    // ESC in chat view is handled here (typing view handles its own ESC via TypingView)
    if (e.key === 'Escape' && appState.currentView === 'typing') {
      // This is a fallback - TypingView handles its own escape
      exitTypingView();
    }
  }

  /**
   * Handle typing session completion.
   * Saves session to DB, then triggers coaching feedback with sessionId linkage.
   */
  async function handleTypingComplete(data: {
    metrics: TypingMetrics;
    keyStats: Record<string, KeyStats>;
    bigramStats: Record<string, KeyStats>;
    text: string;
  }) {
    // Exit typing view first
    exitTypingView();
    setIsLoading(true);
    streaming = '';

    let sessionId: number | undefined;

    // Save session to database
    try {
      const response = await saveSession({
        wpm: data.metrics.wpm,
        accuracy: data.metrics.accuracy,
        errors: data.metrics.errors,
        characters: data.metrics.characters,
        duration_ms: data.metrics.duration_ms,
        text: data.text,
        keyStats: data.keyStats,
        bigramStats: data.bigramStats,
      });
      sessionId = response.id;
    } catch {
      // Session save failed - still try to get coaching feedback
      addMessage({
        id: getNextClientId(),
        role: 'assistant',
        content: 'Failed to save session data, but here\'s your feedback:',
        session_id: null,
        timestamp: Date.now(),
        isError: true,
      });
    }

    // Request coaching feedback with session data and sessionId for rich rendering
    const sessionData: SessionData = {
      wpm: data.metrics.wpm,
      accuracy: data.metrics.accuracy,
      errors: data.metrics.errors,
      characters: data.metrics.characters,
      duration_ms: data.metrics.duration_ms,
      text: data.text,
    };

    await sendChat(
      {
        trigger: 'session_complete',
        sessionData,
        sessionId,
      },
      callbacks
    );
    scrollToBottom();
  }

  function handleTypingCancel() {
    // Discard session data and return to chat silently
    exitTypingView();
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

  // Initialize on mount - runs once
  $effect(() => {
    if (initialLoadStarted) return;
    initialLoadStarted = true;

    (async () => {
      await loadInitialMessages();
      // Only send greeting if no existing messages
      if (appState.messages.length === 0) {
        await sendGreeting();
      }
      scrollToBottom();
    })();
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
  <TypingView
    text={appState.typingText}
    onComplete={handleTypingComplete}
    onCancel={handleTypingCancel}
  />
{/if}
