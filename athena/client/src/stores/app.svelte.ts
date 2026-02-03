import type { Message } from '@typeforge/types';

export type CurrentView = 'chat' | 'typing';
export type ConnectionStatus = 'connected' | 'error' | 'unknown';

export interface AppMessage extends Message {
  isError?: boolean;
}

// Global app state using Svelte 5 runes
let currentView = $state<CurrentView>('chat');
let messages = $state<AppMessage[]>([]);
let connectionStatus = $state<ConnectionStatus>('unknown');
let isLoading = $state(false);
let typingText = $state<string | null>(null);
let hasMoreMessages = $state(true);

export function getAppState() {
  return {
    get currentView() { return currentView; },
    get messages() { return messages; },
    get connectionStatus() { return connectionStatus; },
    get isLoading() { return isLoading; },
    get typingText() { return typingText; },
    get hasMoreMessages() { return hasMoreMessages; },
  };
}

export function setCurrentView(view: CurrentView) {
  currentView = view;
}

export function setMessages(msgs: AppMessage[]) {
  messages = msgs;
}

export function addMessage(msg: AppMessage) {
  messages = [...messages, msg];
}

export function prependMessages(msgs: AppMessage[]) {
  messages = [...msgs, ...messages];
}

export function setConnectionStatus(status: ConnectionStatus) {
  connectionStatus = status;
}

export function setIsLoading(loading: boolean) {
  isLoading = loading;
}

export function setTypingText(text: string | null) {
  typingText = text;
  if (text) {
    currentView = 'typing';
  }
}

export function setHasMoreMessages(hasMore: boolean) {
  hasMoreMessages = hasMore;
}

export function exitTypingView() {
  currentView = 'chat';
  typingText = null;
}
