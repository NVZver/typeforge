import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createDb } from '../src/db.js';
import { addSession, getSession } from '../src/repositories/sessions.js';
import type { SessionRequest } from '@typeforge/types';

const sampleSession: SessionRequest = {
  wpm: 65,
  accuracy: 96.5,
  errors: 4,
  characters: 120,
  duration_ms: 45000,
  text: 'The quick brown fox jumps over the lazy dog',
  keyStats: {
    a: { avgTime: 150, count: 3 },
    s: { avgTime: 200, count: 5 },
  },
  bigramStats: {
    th: { avgTime: 120, count: 4 },
    he: { avgTime: 180, count: 3 },
  },
};

describe('Sessions repository', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDb(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  describe('addSession', () => {
    it('inserts session with key_stats and bigram_stats atomically', () => {
      const { id } = addSession(db, sampleSession);
      expect(id).toBe(1);

      const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as any;
      expect(session.wpm).toBe(65);
      expect(session.accuracy).toBe(96.5);
      expect(session.text).toBe('The quick brown fox jumps over the lazy dog');

      const keyStats = db.prepare('SELECT * FROM key_stats WHERE session_id = ?').all(id);
      expect(keyStats).toHaveLength(2);

      const bigramStats = db.prepare('SELECT * FROM bigram_stats WHERE session_id = ?').all(id);
      expect(bigramStats).toHaveLength(2);
    });

    it('rolls back transaction on failure', () => {
      // Create a fresh DB and drop the key_stats table so that
      // inserting key stats mid-transaction will fail.
      const badDb = createDb(':memory:');
      badDb.exec('DROP TABLE key_stats');

      // Attempt to add a session that includes keyStats entries.
      // The session row insert will succeed, but the key_stats insert
      // will fail because the table no longer exists. The transaction
      // should roll back the session row as well.
      expect(() => addSession(badDb, sampleSession)).toThrow();

      const count = (badDb.prepare('SELECT COUNT(*) as c FROM sessions').get() as any).c;
      expect(count).toBe(0);
      badDb.close();
    });
  });

  describe('getSession', () => {
    it('returns full detail with stats', () => {
      const { id } = addSession(db, sampleSession);
      const detail = getSession(db, id);

      expect(detail).not.toBeNull();
      expect(detail!.session.wpm).toBe(65);
      expect(detail!.keyStats).toHaveLength(2);
      expect(detail!.bigramStats).toHaveLength(2);

      const keys = detail!.keyStats.map(k => k.key).sort();
      expect(keys).toEqual(['a', 's']);
    });

    it('returns null for missing ID', () => {
      const detail = getSession(db, 999);
      expect(detail).toBeNull();
    });
  });
});
