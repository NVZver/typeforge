import type Database from 'better-sqlite3';
import type { SessionData } from '@typeforge/types';
import { buildSystemPrompt } from './system-prompt.js';
import { getWeakestKeys, getWeakestBigrams, getRecentAverages, getTotalSessions, getBestWpm } from '../repositories/stats.js';
import { getRecentMessages } from '../repositories/messages.js';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

type Trigger = 'greeting' | 'session_complete' | null | undefined;

export function assembleContext(
  db: Database.Database,
  trigger: Trigger,
  sessionData?: SessionData | null
): ChatMessage[] {
  const messages: ChatMessage[] = [];

  // System prompt
  messages.push({ role: 'system', content: buildSystemPrompt() });

  // Typing stats block
  const totalSessions = getTotalSessions(db);
  const bestWpm = getBestWpm(db);
  const { avgWpm, avgAccuracy } = getRecentAverages(db);
  const weakKeys = getWeakestKeys(db);
  const weakBigrams = getWeakestBigrams(db);

  const statsLines = [
    `Total sessions: ${totalSessions}`,
    `Best WPM: ${bestWpm}`,
    `Recent avg WPM: ${avgWpm.toFixed(1)}`,
    `Recent avg accuracy: ${(avgAccuracy * 100).toFixed(1)}%`,
  ];

  if (weakKeys.length > 0) {
    statsLines.push(`Weakest keys: ${weakKeys.map(k => `${k.key} (${k.avgTime.toFixed(0)}ms)`).join(', ')}`);
  }
  if (weakBigrams.length > 0) {
    statsLines.push(`Weakest bigrams: ${weakBigrams.map(b => `${b.bigram} (${b.avgTime.toFixed(0)}ms)`).join(', ')}`);
  }

  messages.push({ role: 'system', content: `User's typing stats:\n${statsLines.join('\n')}` });

  // Greeting context
  if (trigger === 'greeting') {
    const greetingParts: string[] = [];

    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    greetingParts.push(`Time of day: ${timeOfDay}`);

    if (totalSessions === 0) {
      greetingParts.push('This is the user\'s first launch — they have no prior sessions.');
    } else {
      const lastSession = db.prepare(
        'SELECT timestamp FROM sessions ORDER BY timestamp DESC LIMIT 1'
      ).get() as { timestamp: number } | undefined;

      if (lastSession) {
        const daysSince = Math.floor((Date.now() - lastSession.timestamp) / (1000 * 60 * 60 * 24));
        greetingParts.push(`Days since last session: ${daysSince}`);
      }
    }

    greetingParts.push('Greet the user and offer to start a practice session.');
    messages.push({ role: 'system', content: greetingParts.join('\n') });
  }

  // Conversation history (last 10 messages)
  const history = getRecentMessages(db, 10);
  for (const msg of history) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  // Session complete context
  if (trigger === 'session_complete' && sessionData) {
    const sessionMsg = [
      'I just completed a typing session:',
      `WPM: ${sessionData.wpm}`,
      `Accuracy: ${(sessionData.accuracy * 100).toFixed(1)}%`,
      `Errors: ${sessionData.errors}`,
      `Characters: ${sessionData.characters}`,
      `Duration: ${(sessionData.duration_ms / 1000).toFixed(1)}s`,
    ].join('\n');

    messages.push({ role: 'user', content: sessionMsg });
  }

  return messages;
}
