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
  textGenQuotesPrompt: string | null;
  textGenWordsPrompt: string | null;
  analysisPrompt: string | null;
  sessionSummaryPrompt: string | null;
  lastUpdated: number;
}

// Default prompts for settings reset
export const DEFAULT_PROMPTS = {
  systemPrompt: 'You are an expert typing coach. Help improve typing speed and accuracy. Be concise and actionable. Format your responses using Markdown for better readability (use **bold** for emphasis, bullet lists, headers, etc.).',

  textGenQuotesPrompt: `Write a single memorable, inspiring quote about {{theme}}. Make it sound like something from a movie or famous speech.

Requirements:
- One or two powerful sentences, around {{wordCount}} words total
- Use these letters frequently if possible: {{weakKeys}}
- Dramatic, inspiring, or thought-provoking tone
- No special characters except period, comma, and exclamation mark
- Output ONLY the quote, nothing else`,

  textGenWordsPrompt: `Generate exactly {{wordCount}} {{complexity}} English words for typing practice.

Requirements:
- Include words that use these letters: {{weakKeys}}
- Include some words with these letter combinations: {{weakBigrams}}
- Words should be separated by single spaces
- No punctuation, just lowercase words
- Output ONLY the words, nothing else`,

  analysisPrompt: `You are a typing coach. Analyze this data and give concise, actionable advice.

**Stats:** {{avgWpm}} WPM avg (best: {{bestWpm}}), {{avgAccuracy}}% accuracy, {{totalSessions}} sessions, trend: {{wpmTrend}}
**Slow keys:** {{weakKeys}}
**Slow bigrams:** {{weakBigrams}}

Respond in **strict markdown** format. Be concise (max 300 words). Use this structure:

## Diagnosis
One sentence on the main issue.

## Priority Focus
The #1 thing to work on now.

## Drills
- 2-3 specific exercises for weak keys/bigrams

## Strategy
Brief practice recommendations.`,

  sessionSummaryPrompt: `You are a typing coach. Give a brief (2-3 sentences) analysis of this typing session. Be encouraging but specific. Use Markdown formatting.

Session results:
- WPM: {{wpm}} {{personalBest}}
- Accuracy: {{accuracy}}%
- Errors: {{errors}}
- Time: {{elapsed}}s
- Slowest keys: {{slowestKeys}}
- Fastest keys: {{fastestKeys}}

Keep it short and actionable. Focus on one specific thing to improve.`
};

// Connection status for LM Studio
export interface ConnectionStatus {
  connected: boolean;
  modelName: string | null;
  checking: boolean;
}
