// Type definitions for TypeForge

export type PracticeMode = 'words' | 'quotes';
export type TextType = 'words' | 'quotes';

export interface CharTiming {
  char: string;
  time: number;      // ms since last keystroke
  correct: boolean;
  index: number;
}

export interface TypingStats {
  wpm: number;
  accuracy: number;
  errors: number;
  characters: number;
  elapsed: number;   // seconds
  complete: boolean;
}

export interface Session {
  wpm: number;
  accuracy: number;
  errors: number;
  characters: number;
  mode: PracticeMode;
  textType: TextType;
  timestamp: number;
}

export interface KeyStats {
  times: number[];
  errors: number;
}

export interface Settings {
  targetWpm: number;
  speedDuration: number;
  enduranceDuration: number;
  burstWords: number;
  dailyGoal: number;
  aiEndpoint: string;
}

export interface StorageData {
  sessions: Session[];
  keyStats: Record<string, KeyStats>;
  bigramStats: Record<string, number[]>;
  bestWpm: number;
  dailyGoal: number;
  settings: Settings;
}

export interface DailyStats {
  sessions: number;
  avgWpm: number;
  bestWpm: number;
  totalChars: number;
}

export interface CalendarDay {
  date: Date;
  sessions: number;
  avgWpm: number;
  isToday: boolean;
  isFuture: boolean;
}

export interface WeakKey {
  key: string;
  avg: number;
  count: number;
}

export interface WeakBigram {
  bigram: string;
  avg: number;
  count: number;
}

export interface AnalysisData {
  summary: {
    avgWpm: number;
    avgAccuracy: number;
    bestWpm: number;
    totalSessions: number;
    wpmTrend: 'improving' | 'stable' | 'declining';
    accuracyIssue: boolean;
    targetWpm: number;
    currentGap: number;
  };
  weakKeys: Array<{ key: string; avgMs: number; samples: number }>;
  weakBigrams: Array<{ bigram: string; avgMs: number; samples: number }>;
  modeBreakdown: Record<string, number>;
  recentWpms: number[];
  recentAccuracies: number[];
}

// Chat types for AI conversation
export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

// Training plan for AI-driven practice
export interface TrainingPlan {
  sessionsSinceUpdate: number;
  currentDifficulty: 'easy' | 'medium' | 'hard';
  currentTheme: string;
  weakKeys: string[];
  weakBigrams: string[];
  practiceMode: 'words' | 'quotes';
  systemPrompt: string;
  lastUpdated: number;
}

// Connection status for LM Studio
export interface ConnectionStatus {
  connected: boolean;
  modelName: string | null;
  checking: boolean;
}
