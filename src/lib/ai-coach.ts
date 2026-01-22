import { storage } from './storage';
import { textGenerator } from './text-generator';
import { AnalysisData, TrainingPlan, TypingStats } from './types';

class AICoachService {
  private endpoint: string = 'http://localhost:1234/v1';
  private isConnected: boolean = false;
  private lastGeneratedText: string | null = null;
  private modelName: string | null = null;

  setEndpoint(endpoint: string): void {
    this.endpoint = endpoint;
  }

  getEndpoint(): string {
    return this.endpoint;
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }

  async testConnection(): Promise<{ success: boolean; modelName?: string }> {
    try {
      const response = await fetch(`${this.endpoint}/models`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        this.isConnected = true;
        this.modelName = data.data?.[0]?.id || 'Connected';
        return { success: true, modelName: this.modelName || undefined };
      }
      throw new Error('Connection failed');
    } catch (error) {
      this.isConnected = false;
      this.modelName = null;
      return { success: false };
    }
  }

  getModelName(): string | null {
    return this.modelName;
  }

  async prepareAnalysisData(): Promise<AnalysisData | null> {
    const data = await storage.load();
    const sessions = data.sessions;
    const keyStats = data.keyStats;
    const bigramStats = data.bigramStats;

    if (sessions.length < 3) {
      return null;
    }

    // Calculate comprehensive metrics
    const recentSessions = sessions.slice(-20);
    const avgWpm = Math.round(recentSessions.reduce((a, s) => a + s.wpm, 0) / recentSessions.length);
    const avgAccuracy = Math.round(recentSessions.reduce((a, s) => a + s.accuracy, 0) / recentSessions.length);
    const bestWpm = data.bestWpm;
    const totalSessions = sessions.length;

    // WPM trend
    let wpmTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (sessions.length >= 10) {
      const recent5 = sessions.slice(-5).reduce((a, s) => a + s.wpm, 0) / 5;
      const previous5 = sessions.slice(-10, -5).reduce((a, s) => a + s.wpm, 0) / 5;
      if (recent5 > previous5 + 3) wpmTrend = 'improving';
      else if (recent5 < previous5 - 3) wpmTrend = 'declining';
    }

    // Find weak keys (slowest)
    const weakKeys: Array<{ key: string; avgMs: number; samples: number }> = [];
    for (const [key, stats] of Object.entries(keyStats)) {
      if (stats.times.length >= 5) {
        const avg = stats.times.reduce((a, b) => a + b, 0) / stats.times.length;
        weakKeys.push({ key, avgMs: Math.round(avg), samples: stats.times.length });
      }
    }
    weakKeys.sort((a, b) => b.avgMs - a.avgMs);

    // Find weak bigrams
    const weakBigrams: Array<{ bigram: string; avgMs: number; samples: number }> = [];
    for (const [bigram, times] of Object.entries(bigramStats)) {
      if (times.length >= 3) {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        weakBigrams.push({ bigram, avgMs: Math.round(avg), samples: times.length });
      }
    }
    weakBigrams.sort((a, b) => b.avgMs - a.avgMs);

    // Session patterns
    const modeBreakdown: Record<string, number> = {};
    recentSessions.forEach(s => {
      modeBreakdown[s.mode] = (modeBreakdown[s.mode] || 0) + 1;
    });

    // Accuracy pattern
    const lowAccuracySessions = recentSessions.filter(s => s.accuracy < 95).length;
    const accuracyIssue = lowAccuracySessions > recentSessions.length * 0.3;

    return {
      summary: {
        avgWpm,
        avgAccuracy,
        bestWpm,
        totalSessions,
        wpmTrend,
        accuracyIssue,
        targetWpm: 100,
        currentGap: 100 - avgWpm
      },
      weakKeys: weakKeys.slice(0, 8),
      weakBigrams: weakBigrams.slice(0, 10),
      modeBreakdown,
      recentWpms: recentSessions.map(s => s.wpm),
      recentAccuracies: recentSessions.map(s => s.accuracy)
    };
  }

  buildPrompt(analysisData: AnalysisData): string {
    return `You are a typing coach. Analyze this data and give concise, actionable advice.

**Stats:** ${analysisData.summary.avgWpm} WPM avg (best: ${analysisData.summary.bestWpm}), ${analysisData.summary.avgAccuracy}% accuracy, ${analysisData.summary.totalSessions} sessions, trend: ${analysisData.summary.wpmTrend}
**Slow keys:** ${analysisData.weakKeys.slice(0, 5).map(k => `${k.key}(${k.avgMs}ms)`).join(', ') || 'none yet'}
**Slow bigrams:** ${analysisData.weakBigrams.slice(0, 5).map(b => `${b.bigram}(${b.avgMs}ms)`).join(', ') || 'none yet'}

Respond in **strict markdown** format. Be concise (max 300 words). Use this structure:

## Diagnosis
One sentence on the main issue.

## Priority Focus
The #1 thing to work on now.

## Drills
- 2-3 specific exercises for weak keys/bigrams

## Strategy
Brief practice recommendations.`;
  }

  async analyze(): Promise<{ content: string; elapsed: number; model: string } | null> {
    const analysisData = await this.prepareAnalysisData();

    if (!analysisData) {
      return null;
    }

    try {
      const prompt = this.buildPrompt(analysisData);
      const startTime = Date.now();

      const response = await fetch(`${this.endpoint}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 600,
          stream: false
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('LM Studio error response:', errorBody);
        throw new Error(`API error: ${response.status} - ${errorBody}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      const elapsed = Number(((Date.now() - startTime) / 1000).toFixed(1));

      if (content) {
        this.isConnected = true;
        return { content, elapsed, model: data.model || 'Unknown' };
      }

      throw new Error('Empty response from model');
    } catch (error) {
      console.error('AI Analysis error:', error);
      this.isConnected = false;
      return null;
    }
  }

  // Clean AI output to remove unwanted characters
  private cleanPracticeText(text: string): string {
    return text
      // Remove markdown formatting
      .replace(/[*_~`#]/g, '')
      // Remove brackets and their contents (often AI adds notes)
      .replace(/\[.*?\]/g, '')
      .replace(/\(.*?\)/g, ' ')
      // Keep only letters, numbers, basic punctuation, and spaces
      .replace(/[^a-zA-Z0-9.,;:!?'"\s-]/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Remove leading/trailing punctuation weirdness
      .replace(/^[^a-zA-Z]+/, '')
      .replace(/[^a-zA-Z.!?]+$/, '')
      .trim();
  }

  async generatePracticeText(): Promise<string | null> {
    const analysisData = await this.prepareAnalysisData();

    if (!analysisData || analysisData.weakKeys.length === 0) {
      return null;
    }

    // Filter to only alphabetic weak keys for the prompt
    const alphabeticKeys = analysisData.weakKeys
      .map(k => k.key)
      .filter(k => /^[a-zA-Z]$/.test(k));

    const alphabeticBigrams = analysisData.weakBigrams
      .slice(0, 5)
      .map(b => b.bigram)
      .filter(b => /^[a-zA-Z]+$/.test(b));

    // Random themes for variety
    const themes = [
      'an epic fantasy adventure with heroes and dragons',
      'a sci-fi space exploration discovery',
      'a detective solving a mysterious case',
      'a motivational speech about achieving dreams',
      'a nature documentary about wildlife',
      'a sports commentator describing an exciting moment',
      'a chef describing a delicious recipe',
      'a traveler exploring ancient ruins',
      'a scientist making a breakthrough discovery',
      'a musician performing their greatest concert',
      'a pilot navigating through a storm',
      'a diver exploring the deep ocean',
      'a mountain climber reaching the summit',
      'an astronaut seeing Earth from space',
      'a writer finishing their masterpiece novel'
    ];
    const theme = themes[Math.floor(Math.random() * themes.length)];

    const prompt = `Write a single memorable quote or dramatic line about ${theme}. Make it sound like something from a movie, game, or famous speech.

Requirements:
- One or two powerful sentences, around 40-60 words total
- Use these letters frequently: ${alphabeticKeys.join(', ')}
- Dramatic, inspiring, or thought-provoking tone
- No special characters except period, comma, and exclamation mark
- Output ONLY the quote, nothing else

Examples of the style wanted:
- In the darkest hour, when hope seems lost, the brave find strength they never knew they had.
- The stars whispered secrets of ancient worlds, and those who listened discovered the universe was never silent.`;

    try {
      const response = await fetch(`${this.endpoint}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 150,
          stream: false
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('LM Studio error response:', errorBody);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      let text = data.choices?.[0]?.message?.content?.trim();

      if (text && text.length > 20) {
        // Clean and normalize the text
        text = this.cleanPracticeText(text);
        text = textGenerator.normalize(text);

        if (text.length > 20) {
          this.lastGeneratedText = text;
          this.isConnected = true;
          return text;
        }
      }
    } catch (error) {
      console.error('AI text generation failed:', error);
    }

    return null;
  }

  getLastGeneratedText(): string | null {
    return this.lastGeneratedText;
  }

  // Send a chat message to the AI coach
  async sendChatMessage(
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string
  ): Promise<string | null> {
    try {
      const response = await fetch(`${this.endpoint}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages
          ],
          temperature: 0.7,
          max_tokens: 500,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (content) {
        this.isConnected = true;
        return content;
      }

      throw new Error('Empty response from model');
    } catch (error) {
      console.error('Chat error:', error);
      this.isConnected = false;
      return null;
    }
  }

  // Generate practice text based on training plan
  async generatePracticeTextWithPlan(plan: TrainingPlan): Promise<string | null> {
    const { practiceMode, currentDifficulty, currentTheme, weakKeys, weakBigrams } = plan;

    // Filter to only alphabetic characters
    const alphabeticKeys = weakKeys.filter(k => /^[a-zA-Z]$/.test(k));
    const alphabeticBigrams = weakBigrams.filter(b => /^[a-zA-Z]+$/.test(b));

    // Build prompt based on mode and difficulty
    let prompt: string;

    if (practiceMode === 'quotes') {
      const lengthGuide = currentDifficulty === 'easy' ? '30-40' : currentDifficulty === 'medium' ? '40-60' : '60-80';
      prompt = `Write a single memorable, inspiring quote about ${currentTheme}. Make it sound like something from a movie or famous speech.

Requirements:
- One or two powerful sentences, around ${lengthGuide} words total
- Use these letters frequently if possible: ${alphabeticKeys.join(', ') || 'common letters'}
- Dramatic, inspiring, or thought-provoking tone
- No special characters except period, comma, and exclamation mark
- Output ONLY the quote, nothing else

Examples of the style wanted:
- In the darkest hour, when hope seems lost, the brave find strength they never knew they had.
- The stars whispered secrets of ancient worlds, and those who listened discovered the universe was never silent.`;
    } else {
      // Words mode - generate word practice
      const wordCount = currentDifficulty === 'easy' ? 25 : currentDifficulty === 'medium' ? 35 : 50;
      const complexity = currentDifficulty === 'easy' ? 'simple, common' : currentDifficulty === 'medium' ? 'moderately common' : 'varied and challenging';

      prompt = `Generate exactly ${wordCount} ${complexity} English words for typing practice.

Requirements:
- Include words that use these letters: ${alphabeticKeys.join(', ') || 'common letters'}
- Include some words with these letter combinations: ${alphabeticBigrams.join(', ') || 'common combinations'}
- Words should be separated by single spaces
- No punctuation, just lowercase words
- Output ONLY the words, nothing else

Example format: the quick brown fox jumps over the lazy dog near the riverbank`;
    }

    try {
      const response = await fetch(`${this.endpoint}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.8,
          max_tokens: 200,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      let text = data.choices?.[0]?.message?.content?.trim();

      if (text && text.length > 20) {
        text = this.cleanPracticeText(text);
        text = textGenerator.normalize(text);

        if (text.length > 20) {
          this.lastGeneratedText = text;
          this.isConnected = true;
          return text;
        }
      }
    } catch (error) {
      console.error('AI text generation failed:', error);
    }

    return null;
  }

  // Generate a short AI summary of a typing session
  async generateSessionSummary(
    stats: TypingStats,
    keyTimes: Record<string, number[]>,
    bestWpm: number
  ): Promise<string | null> {
    // Find slowest keys from this session
    const keyAvgTimes: Array<{ key: string; avg: number }> = [];
    for (const [key, times] of Object.entries(keyTimes)) {
      if (times.length > 0 && /^[a-zA-Z]$/.test(key)) {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        keyAvgTimes.push({ key: key.toLowerCase(), avg });
      }
    }
    keyAvgTimes.sort((a, b) => b.avg - a.avg);
    const slowestKeys = keyAvgTimes.slice(0, 3).map(k => k.key);
    const fastestKeys = keyAvgTimes.slice(-3).map(k => k.key).reverse();

    const isNewBest = stats.wpm >= bestWpm && stats.wpm > 0;

    const prompt = `You are a typing coach. Give a brief (2-3 sentences) analysis of this typing session. Be encouraging but specific. Use Markdown formatting.

Session results:
- WPM: ${stats.wpm} ${isNewBest ? '(NEW PERSONAL BEST!)' : `(best: ${bestWpm})`}
- Accuracy: ${stats.accuracy}%
- Errors: ${stats.errors}
- Time: ${stats.elapsed}s
- Slowest keys: ${slowestKeys.join(', ') || 'N/A'}
- Fastest keys: ${fastestKeys.join(', ') || 'N/A'}

Keep it short and actionable. Focus on one specific thing to improve.`;

    try {
      const response = await fetch(`${this.endpoint}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 150,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();

      if (content) {
        this.isConnected = true;
        return content;
      }
    } catch (error) {
      console.error('AI summary generation failed:', error);
    }

    return null;
  }
}

export const aiCoach = new AICoachService();
