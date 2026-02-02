import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createDb } from '../src/db.js';
import { addSession } from '../src/repositories/sessions.js';
import {
  getWeakestKeys,
  getWeakestBigrams,
  getRecentAverages,
  getTotalSessions,
  getBestWpm,
} from '../src/repositories/stats.js';
import type { SessionRequest } from '@typeforge/types';

function makeSession(overrides: Partial<SessionRequest> = {}): SessionRequest {
  return {
    wpm: 60,
    accuracy: 95,
    errors: 3,
    characters: 100,
    duration_ms: 60000,
    text: 'test',
    keyStats: {},
    bigramStats: {},
    ...overrides,
  };
}

describe('Stats repository', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDb(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  describe('getWeakestKeys', () => {
    it('returns top N keys by avg time descending', () => {
      addSession(db, makeSession({
        keyStats: {
          a: { avgTime: 100, count: 5 },
          b: { avgTime: 300, count: 5 },
          c: { avgTime: 200, count: 5 },
        },
      }));

      const weak = getWeakestKeys(db, 2);
      expect(weak).toHaveLength(2);
      expect(weak[0].key).toBe('b');
      expect(weak[0].avgTime).toBe(300);
      expect(weak[1].key).toBe('c');
    });

    it('returns empty array for empty DB', () => {
      expect(getWeakestKeys(db)).toEqual([]);
    });
  });

  describe('getWeakestBigrams', () => {
    it('returns top N bigrams by avg time descending', () => {
      addSession(db, makeSession({
        bigramStats: {
          th: { avgTime: 150, count: 3 },
          he: { avgTime: 250, count: 3 },
        },
      }));

      const weak = getWeakestBigrams(db, 1);
      expect(weak).toHaveLength(1);
      expect(weak[0].bigram).toBe('he');
      expect(weak[0].avgTime).toBe(250);
    });

    it('returns empty array for empty DB', () => {
      expect(getWeakestBigrams(db)).toEqual([]);
    });
  });

  describe('getRecentAverages', () => {
    it('computes correct averages', () => {
      addSession(db, makeSession({ wpm: 50, accuracy: 90 }));
      addSession(db, makeSession({ wpm: 70, accuracy: 100 }));

      const avgs = getRecentAverages(db, 10);
      expect(avgs.avgWpm).toBe(60);
      expect(avgs.avgAccuracy).toBe(95);
    });

    it('returns zeros for empty DB', () => {
      const avgs = getRecentAverages(db);
      expect(avgs.avgWpm).toBe(0);
      expect(avgs.avgAccuracy).toBe(0);
    });
  });

  describe('getTotalSessions', () => {
    it('counts correctly', () => {
      expect(getTotalSessions(db)).toBe(0);
      addSession(db, makeSession());
      addSession(db, makeSession());
      expect(getTotalSessions(db)).toBe(2);
    });
  });

  describe('getBestWpm', () => {
    it('returns max wpm', () => {
      addSession(db, makeSession({ wpm: 50 }));
      addSession(db, makeSession({ wpm: 80 }));
      addSession(db, makeSession({ wpm: 65 }));

      expect(getBestWpm(db)).toBe(80);
    });

    it('returns 0 for empty DB', () => {
      expect(getBestWpm(db)).toBe(0);
    });
  });
});
