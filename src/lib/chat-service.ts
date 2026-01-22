import { ChatMessage, Session, TrainingPlan, WeakKey, WeakBigram } from './types';
import { storage } from './storage';

interface TypingContext {
  sessions: Session[];
  weakKeys: WeakKey[];
  weakBigrams: WeakBigram[];
  trainingPlan: TrainingPlan;
}

class ChatService {
  async loadMessages(): Promise<ChatMessage[]> {
    const response = await fetch('/api/chat');
    if (!response.ok) throw new Error('Failed to load chat messages');
    return response.json();
  }

  async addMessage(role: 'user' | 'assistant', content: string): Promise<void> {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, content })
    });
    if (!response.ok) throw new Error('Failed to add message');
  }

  async clearHistory(): Promise<void> {
    const response = await fetch('/api/chat', { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to clear history');
  }

  // Parse /system command
  parseSystemCommand(input: string): { isCommand: boolean; prompt?: string } {
    const trimmed = input.trim();
    if (trimmed.toLowerCase().startsWith('/system ')) {
      return {
        isCommand: true,
        prompt: trimmed.slice(8).trim() // Remove '/system ' prefix
      };
    }
    return { isCommand: false };
  }

  // Build typing context with metrics
  buildTypingContextString(ctx: TypingContext): string {
    const { sessions, weakKeys, weakBigrams, trainingPlan } = ctx;

    // Session summary
    const recentSessions = sessions.slice(-20);
    let sessionSummary = '';
    if (recentSessions.length > 0) {
      const avgWpm = Math.round(recentSessions.reduce((a, s) => a + s.wpm, 0) / recentSessions.length);
      const avgAccuracy = Math.round(recentSessions.reduce((a, s) => a + s.accuracy, 0) / recentSessions.length);
      const bestWpm = Math.max(...recentSessions.map(s => s.wpm));
      const worstWpm = Math.min(...recentSessions.map(s => s.wpm));

      // Recent trend (last 5 vs previous 5)
      let trend = 'stable';
      if (recentSessions.length >= 10) {
        const recent5 = recentSessions.slice(-5).reduce((a, s) => a + s.wpm, 0) / 5;
        const prev5 = recentSessions.slice(-10, -5).reduce((a, s) => a + s.wpm, 0) / 5;
        if (recent5 > prev5 + 3) trend = 'improving';
        else if (recent5 < prev5 - 3) trend = 'declining';
      }

      sessionSummary = `[PROGRESS - Last ${recentSessions.length} sessions]
Avg WPM: ${avgWpm} | Best: ${bestWpm} | Worst: ${worstWpm}
Avg Accuracy: ${avgAccuracy}%
Trend: ${trend}
Recent sessions (newest first): ${recentSessions.slice(-5).reverse().map(s => `${s.wpm}wpm/${s.accuracy}%`).join(', ')}`;
    } else {
      sessionSummary = '[PROGRESS] No sessions yet - new user';
    }

    // Weak keys
    const weakKeysStr = weakKeys.length > 0
      ? `[WEAK KEYS] ${weakKeys.map(k => `'${k.key}' (${k.avg}ms avg, ${k.count} samples)`).join(', ')}`
      : '[WEAK KEYS] Not enough data yet';

    // Weak bigrams
    const weakBigramsStr = weakBigrams.length > 0
      ? `[WEAK BIGRAMS] ${weakBigrams.map(b => `'${b.bigram}' (${b.avg}ms avg)`).join(', ')}`
      : '[WEAK BIGRAMS] Not enough data yet';

    // Training plan
    const planStr = `[TRAINING PLAN]
Mode: ${trainingPlan.practiceMode} | Difficulty: ${trainingPlan.currentDifficulty} | Theme: ${trainingPlan.currentTheme}
Sessions until auto-update: ${5 - trainingPlan.sessionsSinceUpdate}`;

    return `${sessionSummary}

${weakKeysStr}

${weakBigramsStr}

${planStr}`;
  }

  // Build full context for AI chat
  buildContext(
    messages: ChatMessage[],
    typingContext?: TypingContext
  ): Array<{ role: string; content: string }> {
    const context: Array<{ role: string; content: string }> = [];

    // Add typing context as first user message if available
    if (typingContext) {
      context.push({
        role: 'user',
        content: `[TYPING METRICS - Auto-updated context, don't respond to this directly]\n${this.buildTypingContextString(typingContext)}`
      });
      context.push({
        role: 'assistant',
        content: 'I have your current typing metrics. How can I help you improve?'
      });
    }

    // Add recent chat messages (last 10)
    const recentMessages = messages.slice(-10);
    for (const msg of recentMessages) {
      if (msg.role !== 'system') {
        context.push({ role: msg.role, content: msg.content });
      }
    }

    return context;
  }

  // Load typing context for the chat
  async loadTypingContext(trainingPlan: TrainingPlan): Promise<TypingContext> {
    const data = await storage.load();
    const weakKeys = await storage.getWeakKeys(8);
    const weakBigrams = await storage.getWeakBigrams(8);

    return {
      sessions: data.sessions,
      weakKeys,
      weakBigrams,
      trainingPlan
    };
  }
}

export const chatService = new ChatService();
