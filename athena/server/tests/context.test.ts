import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createDb } from '../src/db.js';
import { assembleContext } from '../src/agent/context.js';
import { addMessage } from '../src/repositories/messages.js';
import { addSession } from '../src/repositories/sessions.js';

let db: Database.Database;

beforeEach(() => {
  db = createDb(':memory:');
});

afterEach(() => {
  db.close();
});

describe('assembleContext', () => {
  it('returns system prompt + stats with zeros when no sessions exist', () => {
    const messages = assembleContext(db, null);

    expect(messages.length).toBeGreaterThanOrEqual(2);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('Athena');

    // Stats block
    expect(messages[1].role).toBe('system');
    expect(messages[1].content).toContain('Total sessions: 0');
    expect(messages[1].content).toContain('Best WPM: 0');
  });

  it('includes greeting context with time-of-day and firstLaunch on greeting trigger', () => {
    const messages = assembleContext(db, 'greeting');

    const greetingMsg = messages.find(
      m => m.role === 'system' && m.content.includes('Time of day:')
    );
    expect(greetingMsg).toBeDefined();
    expect(greetingMsg!.content).toContain('first launch');
    expect(greetingMsg!.content).toMatch(/Time of day: (morning|afternoon|evening)/);
  });

  it('includes daysSinceLastSession on greeting with existing sessions', () => {
    addSession(db, {
      wpm: 45, accuracy: 0.92, errors: 3, characters: 100,
      duration_ms: 30000, text: 'test text',
      keyStats: { a: { avgTime: 120, count: 5 } },
      bigramStats: { ab: { avgTime: 200, count: 3 } },
    });

    const messages = assembleContext(db, 'greeting');
    const greetingMsg = messages.find(
      m => m.role === 'system' && m.content.includes('Days since last session:')
    );
    expect(greetingMsg).toBeDefined();
  });

  it('includes session metrics on session_complete trigger', () => {
    const sessionData = {
      wpm: 55, accuracy: 0.95, errors: 2,
      characters: 150, duration_ms: 45000, text: 'test',
    };

    const messages = assembleContext(db, 'session_complete', sessionData);
    const sessionMsg = messages.find(
      m => m.role === 'user' && m.content.includes('completed a typing session')
    );
    expect(sessionMsg).toBeDefined();
    expect(sessionMsg!.content).toContain('WPM: 55');
    expect(sessionMsg!.content).toContain('95.0%');
  });

  it('appends user message to context for normal trigger', () => {
    // Normal flow: user message is added to DB before assembleContext
    addMessage(db, { role: 'user', content: 'Hello Athena' });

    const messages = assembleContext(db, null);
    const userMsg = messages.find(
      m => m.role === 'user' && m.content === 'Hello Athena'
    );
    expect(userMsg).toBeDefined();
  });

  it('includes stats with actual values from DB', () => {
    addSession(db, {
      wpm: 60, accuracy: 0.95, errors: 2, characters: 200,
      duration_ms: 40000, text: 'test text',
      keyStats: { q: { avgTime: 300, count: 5 } },
      bigramStats: { qu: { avgTime: 400, count: 3 } },
    });

    const messages = assembleContext(db, null);
    const statsMsg = messages[1];

    expect(statsMsg.content).toContain('Total sessions: 1');
    expect(statsMsg.content).toContain('Best WPM: 60');
    expect(statsMsg.content).toContain('Weakest keys: q');
    expect(statsMsg.content).toContain('Weakest bigrams: qu');
  });

  it('includes last 10 messages in correct order', () => {
    // Add 12 messages — only last 10 should appear
    for (let i = 1; i <= 12; i++) {
      addMessage(db, { role: i % 2 === 0 ? 'assistant' : 'user', content: `msg-${i}` });
    }

    const messages = assembleContext(db, null);
    const chatMessages = messages.filter(
      m => m.role !== 'system'
    );

    expect(chatMessages.length).toBe(10);
    expect(chatMessages[0].content).toBe('msg-3');
    expect(chatMessages[9].content).toBe('msg-12');
  });

  it('keeps total message count reasonable', () => {
    // With history, stats, system prompt, greeting
    for (let i = 0; i < 10; i++) {
      addMessage(db, { role: 'user', content: `message ${i}` });
    }

    const messages = assembleContext(db, 'greeting');
    // system prompt + stats + greeting + 10 history = 13
    expect(messages.length).toBeLessThanOrEqual(15);
  });
});
