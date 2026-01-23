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
    return `Analyze typing performance data and provide coaching feedback.

PERFORMANCE DATA:
- Average WPM: ${analysisData.summary.avgWpm} | Personal Best: ${analysisData.summary.bestWpm}
- Accuracy: ${analysisData.summary.avgAccuracy}%
- Total sessions: ${analysisData.summary.totalSessions}
- Trend: ${analysisData.summary.wpmTrend}
- Slowest keys: ${analysisData.weakKeys.slice(0, 5).map(k => `${k.key}(${k.avgMs}ms)`).join(', ') || 'none yet'}
- Slowest bigrams: ${analysisData.weakBigrams.slice(0, 5).map(b => `${b.bigram}(${b.avgMs}ms)`).join(', ') || 'none yet'}

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

Keep total response under 250 words. Be specific and actionable.`;
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
      let content = data.choices?.[0]?.message?.content;
      const elapsed = Number(((Date.now() - startTime) / 1000).toFixed(1));

      if (content) {
        // Clean up any code block wrappers
        content = this.cleanMarkdownResponse(content);
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

  // Clean markdown response - strip code block wrappers if present
  private cleanMarkdownResponse(text: string): string {
    let cleaned = text.trim();
    // Remove code block wrappers (```markdown ... ``` or ``` ... ```)
    cleaned = cleaned.replace(/^```(?:markdown|md)?\s*\n?/i, '');
    cleaned = cleaned.replace(/\n?```\s*$/i, '');
    return cleaned.trim();
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

    const prompt = `Generate ONE practice quote for typing training.

CONTEXT:
- Theme: ${theme}
- Target length: 40-60 words
- Weak keys to include: ${alphabeticKeys.join(', ') || 'common letters'}

REQUIREMENTS:
1. Exactly one quote, 40-60 words
2. Naturally incorporate words containing the weak keys listed above
3. Allowed characters: a-z, A-Z, spaces, periods, commas, exclamation marks only
4. Inspiring, memorable tone - like a movie quote or motivational speech

OUTPUT FORMAT:
Return ONLY the quote text. No quotation marks, no attribution, no explanation.

EXAMPLES:
In the darkest hour when hope seems lost, the brave find strength they never knew existed within their hearts.

The greatest journeys begin with a single step forward into the unknown, where courage meets opportunity.`;

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
      let content = data.choices?.[0]?.message?.content;

      if (content) {
        // Clean up any code block wrappers
        content = this.cleanMarkdownResponse(content);
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
      prompt = `Generate ONE practice quote for typing training.

CONTEXT:
- Theme: ${currentTheme}
- Target length: ${lengthGuide} words
- Weak keys to include: ${alphabeticKeys.join(', ') || 'common letters'}

REQUIREMENTS:
1. Exactly one quote, ${lengthGuide} words (+/- 5 words acceptable)
2. Naturally incorporate words containing the weak keys listed above
3. Allowed characters: a-z, A-Z, spaces, periods, commas, exclamation marks only
4. Inspiring, memorable tone - like a movie quote or motivational speech

OUTPUT FORMAT:
Return ONLY the quote text. No quotation marks, no attribution, no explanation.

EXAMPLES:
In the darkest hour when hope seems lost, the brave find strength they never knew existed within their hearts.

The greatest journeys begin with a single step forward into the unknown, where courage meets opportunity.`;
    } else {
      // Words mode - generate word practice
      const wordCount = currentDifficulty === 'easy' ? 25 : currentDifficulty === 'medium' ? 35 : 50;
      const complexity = currentDifficulty === 'easy' ? 'simple, common' : currentDifficulty === 'medium' ? 'moderately common' : 'varied and challenging';

      prompt = `Generate a word list for typing practice.

CONTEXT:
- Word count: exactly ${wordCount} words
- Difficulty: ${complexity}
- Target letters: ${alphabeticKeys.join(', ') || 'common letters'}
- Target bigrams: ${alphabeticBigrams.join(', ') || 'common combinations'}

REQUIREMENTS:
1. Exactly ${wordCount} words, space-separated
2. All lowercase, no punctuation
3. Prioritize words containing the target letters and bigrams
4. Mix word lengths: 40% short (3-4 letters), 40% medium (5-7), 20% long (8+)
5. Use real English words only

OUTPUT FORMAT:
Return ONLY the words separated by single spaces. No numbering, no line breaks.

EXAMPLE (for 10 words):
quick example jumping rhythm together quality flowing strength exercise practice`;
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

    const prompt = `Provide brief feedback on a completed typing session.

SESSION DATA:
- Speed: ${stats.wpm} WPM ${isNewBest ? '(NEW PERSONAL BEST!)' : `(best: ${bestWpm})`}
- Accuracy: ${stats.accuracy}%
- Errors: ${stats.errors}
- Duration: ${stats.elapsed} seconds
- Slowest keys: ${slowestKeys.join(', ') || 'N/A'}
- Fastest keys: ${fastestKeys.join(', ') || 'N/A'}

RESPONSE REQUIREMENTS:
- Length: 2-3 sentences maximum
- Tone: Encouraging but specific
- Include: One concrete observation + one actionable tip
- If personal best: Lead with celebration, then one improvement area
- If accuracy <90%: Prioritize accuracy advice over speed

OUTPUT FORMAT:
Return coaching feedback in plain markdown (NOT wrapped in code blocks). Use **bold** for emphasis on key metrics or achievements.`;

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
      let content = data.choices?.[0]?.message?.content?.trim();

      if (content) {
        // Clean up any code block wrappers the AI might have added
        content = this.cleanMarkdownResponse(content);
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
