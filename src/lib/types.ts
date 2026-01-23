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
  systemPrompt: `You are TypeForge Coach, an expert typing instructor with 20+ years of experience training professional typists. Your communication style is:

- **Direct and actionable**: Every response includes something the user can immediately practice
- **Encouraging but honest**: Celebrate progress while identifying areas for improvement
- **Data-driven**: Reference specific metrics (WPM, accuracy, weak keys) in your advice
- **Concise**: Respect the user's time - keep responses under 200 words unless asked for detail

Format all responses in Markdown. Use **bold** for key terms, bullet lists for multiple items, and \`code formatting\` for specific keys or letter combinations.

Never say "I cannot" or apologize. Focus on solutions and next steps.`,

  textGenQuotesPrompt: `Generate ONE practice quote for typing training.

CONTEXT:
- Theme: {{theme}}
- Target length: {{wordCount}} words
- Weak keys to include: {{weakKeys}}

REQUIREMENTS:
1. Exactly one quote, {{wordCount}} words (+/- 5 words acceptable)
2. Naturally incorporate words containing: {{weakKeys}}
3. Allowed characters: a-z, A-Z, spaces, periods, commas, exclamation marks only
4. Inspiring, memorable tone - like a movie quote or motivational speech

OUTPUT FORMAT:
Return ONLY the quote text. No quotation marks, no attribution, no explanation.

EXAMPLES:
In the darkest hour when hope seems lost, the brave find strength they never knew existed within their hearts.

The greatest journeys begin with a single step forward into the unknown, where courage meets opportunity.`,

  textGenWordsPrompt: `Generate a word list for typing practice.

CONTEXT:
- Word count: exactly {{wordCount}} words
- Difficulty: {{complexity}}
- Target letters: {{weakKeys}}
- Target bigrams: {{weakBigrams}}

REQUIREMENTS:
1. Exactly {{wordCount}} words, space-separated
2. All lowercase, no punctuation
3. Prioritize words containing: {{weakKeys}} and {{weakBigrams}}
4. Mix word lengths: 40% short (3-4 letters), 40% medium (5-7), 20% long (8+)
5. Use real English words only

OUTPUT FORMAT:
Return ONLY the words separated by single spaces. No numbering, no line breaks.

EXAMPLE (for 10 words):
quick example jumping rhythm together quality flowing strength exercise practice`,

  analysisPrompt: `Analyze typing performance data and provide coaching feedback.

PERFORMANCE DATA:
- Average WPM: {{avgWpm}} | Personal Best: {{bestWpm}}
- Accuracy: {{avgAccuracy}}%
- Total sessions: {{totalSessions}}
- Trend: {{wpmTrend}}
- Slowest keys (ms): {{weakKeys}}
- Slowest bigrams (ms): {{weakBigrams}}

ANALYSIS FRAMEWORK:
1. Identify the PRIMARY bottleneck (speed vs accuracy vs consistency)
2. Connect weak keys/bigrams to specific finger positions
3. Recommend targeted drills

RESPONSE FORMAT (strict markdown):

## Diagnosis
[One sentence identifying the main issue]

## Priority Focus
[The single most impactful thing to work on - be specific]

## Drills
- [Drill 1 with specific keys/bigrams to target]
- [Drill 2 with practice technique]
- [Drill 3 - optional, only if relevant]

## Strategy
[2-3 sentences on practice approach for the next 5 sessions]

Keep total response under 250 words. Be specific and actionable. Do NOT wrap response in code blocks.`,

  sessionSummaryPrompt: `Provide brief feedback on a completed typing session.

SESSION DATA:
- Speed: {{wpm}} WPM {{personalBest}}
- Accuracy: {{accuracy}}%
- Errors: {{errors}}
- Duration: {{elapsed}} seconds
- Slowest keys: {{slowestKeys}}
- Fastest keys: {{fastestKeys}}

RESPONSE REQUIREMENTS:
- Length: 2-3 sentences maximum
- Tone: Encouraging but specific
- Include: One concrete observation + one actionable tip
- If personal best: Lead with celebration, then one improvement area
- If accuracy <90%: Prioritize accuracy advice over speed

OUTPUT FORMAT:
Return coaching feedback in markdown. Use **bold** for emphasis on key metrics or achievements.

EXAMPLES:
**Great session!** Your 67 WPM shows solid rhythm. Focus on the 'r' and 'th' keys next time - slowing slightly on those will boost both speed and accuracy.

**New personal best at 72 WPM!** Your speed is climbing. Watch your accuracy on words with 'qu' - taking a breath before tricky combinations prevents rushed errors.`
};

// Connection status for LM Studio
export interface ConnectionStatus {
  connected: boolean;
  modelName: string | null;
  checking: boolean;
}
