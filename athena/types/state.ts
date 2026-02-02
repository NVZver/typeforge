import type { Message } from './database';

export type CurrentView = 'chat' | 'typing';
export type ConnectionStatus = 'connected' | 'error';

export interface AppState {
  currentView: CurrentView;
  messages: Message[];
  connectionStatus: ConnectionStatus;
  isLoading: boolean;
  typingText: string | null;
}
