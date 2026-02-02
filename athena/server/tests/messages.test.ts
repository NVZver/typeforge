import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createDb } from '../src/db.js';
import { addMessage, getMessages, getRecentMessages } from '../src/repositories/messages.js';

describe('Messages repository', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDb(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  describe('addMessage', () => {
    it('creates a message with auto-timestamp', () => {
      const before = Date.now();
      const msg = addMessage(db, { role: 'user', content: 'hello' });
      const after = Date.now();

      expect(msg.id).toBe(1);
      expect(msg.role).toBe('user');
      expect(msg.content).toBe('hello');
      expect(msg.session_id).toBeNull();
      expect(msg.timestamp).toBeGreaterThanOrEqual(before - 1000);
      expect(msg.timestamp).toBeLessThanOrEqual(after + 1000);
    });

    it('links message to session when sessionId provided', () => {
      // Create a session first
      db.prepare(`
        INSERT INTO sessions (wpm, accuracy, errors, characters, duration_ms, text)
        VALUES (60, 95, 3, 100, 60000, 'test text')
      `).run();

      const msg = addMessage(db, { role: 'assistant', content: 'nice!', sessionId: 1 });
      expect(msg.session_id).toBe(1);
    });
  });

  describe('getMessages', () => {
    beforeEach(() => {
      // Insert messages with explicit timestamps for predictable ordering
      const stmt = db.prepare('INSERT INTO messages (role, content, timestamp) VALUES (?, ?, ?)');
      for (let i = 1; i <= 5; i++) {
        stmt.run('user', `msg ${i}`, i * 1000);
      }
    });

    it('returns messages in chronological order', () => {
      const { messages } = getMessages(db);
      expect(messages.map(m => m.content)).toEqual([
        'msg 1', 'msg 2', 'msg 3', 'msg 4', 'msg 5',
      ]);
    });

    it('respects limit parameter', () => {
      const { messages, hasMore } = getMessages(db, { limit: 3 });
      expect(messages).toHaveLength(3);
      expect(hasMore).toBe(true);
    });

    it('hasMore is false when all messages fit', () => {
      const { messages, hasMore } = getMessages(db, { limit: 10 });
      expect(messages).toHaveLength(5);
      expect(hasMore).toBe(false);
    });

    it('cursor-based pagination with before', () => {
      const { messages } = getMessages(db, { before: 4000, limit: 2 });
      expect(messages.map(m => m.content)).toEqual(['msg 2', 'msg 3']);
    });
  });

  describe('getRecentMessages', () => {
    it('returns only user/assistant messages', () => {
      addMessage(db, { role: 'system', content: 'system prompt' });
      addMessage(db, { role: 'user', content: 'hi' });
      addMessage(db, { role: 'assistant', content: 'hello' });

      const recent = getRecentMessages(db, 10);
      expect(recent).toHaveLength(2);
      expect(recent.map(m => m.role)).toEqual(['user', 'assistant']);
    });

    it('respects count limit', () => {
      for (let i = 0; i < 5; i++) {
        addMessage(db, { role: 'user', content: `msg ${i}` });
      }
      const recent = getRecentMessages(db, 3);
      expect(recent).toHaveLength(3);
    });
  });
});
