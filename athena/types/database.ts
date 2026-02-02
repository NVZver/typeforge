/** Message roles */
export type MessageRole = 'user' | 'assistant' | 'system';

/** Persisted chat message */
export interface Message {
  id: number;
  role: MessageRole;
  content: string;
  session_id: number | null;
  timestamp: number; // Unix ms
}

/** Completed typing session */
export interface Session {
  id: number;
  wpm: number;
  accuracy: number;
  errors: number;
  characters: number;
  duration_ms: number;
  text: string;
  timestamp: number; // Unix ms
}

/** Per-key timing aggregate for a session */
export interface KeyStat {
  id: number;
  key: string;
  avg_time_ms: number;
  sample_count: number;
  session_id: number;
}

/** Bigram timing aggregate for a session */
export interface BigramStat {
  id: number;
  bigram: string;
  avg_time_ms: number;
  sample_count: number;
  session_id: number;
}
