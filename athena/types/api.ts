import type { Message, Session, KeyStat, BigramStat } from './database';

/** POST /api/chat */
export interface ChatRequest {
  message?: string;
  trigger?: 'greeting' | 'session_complete' | null;
  sessionData?: SessionData | null;
  sessionId?: number;
}

/** Session metrics payload (sent with session_complete trigger) */
export interface SessionData {
  wpm: number;
  accuracy: number;
  errors: number;
  characters: number;
  duration_ms: number;
  text: string;
}

/** POST /api/session */
export interface SessionRequest {
  wpm: number;
  accuracy: number;
  errors: number;
  characters: number;
  duration_ms: number;
  text: string;
  keyStats: Record<string, { avgTime: number; count: number }>;
  bigramStats: Record<string, { avgTime: number; count: number }>;
}

/** POST /api/session response */
export interface SessionResponse {
  id: number;
}

/** GET /api/messages response */
export interface MessagesResponse {
  messages: Message[];
  hasMore: boolean;
}

/** GET /api/stats response */
export interface StatsResponse {
  totalSessions: number;
  recentAvgWpm: number;
  recentAvgAccuracy: number;
  bestWpm: number;
  weakestKeys: Array<{ key: string; avgTime: number }>;
  weakestBigrams: Array<{ bigram: string; avgTime: number }>;
}

/** GET /api/health response */
export interface HealthResponse {
  status: 'connected' | 'error';
  model: string | null;
  error: string | null;
}

/** GET /api/session/:id response */
export interface SessionDetailResponse {
  session: Session;
  keyStats: KeyStat[];
  bigramStats: BigramStat[];
}
