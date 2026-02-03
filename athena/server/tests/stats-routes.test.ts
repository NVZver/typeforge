import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import express from 'express';
import { createDb } from '../src/db.js';
import { createStatsRouter } from '../src/routes/stats.js';
import { addSession } from '../src/repositories/sessions.js';

let db: Database.Database;
let app: express.Express;

beforeEach(() => {
  db = createDb(':memory:');
  app = express();
  app.use(express.json());
  app.use('/api', createStatsRouter(db));
});

afterEach(() => {
  db.close();
});

describe('GET /api/stats', () => {
  it('returns zeros when no sessions exist', async () => {
    const res = await request(app).get('/api/stats');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      totalSessions: 0,
      bestWpm: 0,
      recentAvgWpm: 0,
      recentAvgAccuracy: 0,
      weakestKeys: [],
      weakestBigrams: [],
    });
  });

  it('returns correct totalSessions count', async () => {
    addSession(db, {
      wpm: 50, accuracy: 0.9, errors: 2, characters: 100,
      duration_ms: 30000, text: 'test',
      keyStats: {}, bigramStats: {},
    });
    addSession(db, {
      wpm: 60, accuracy: 0.95, errors: 1, characters: 120,
      duration_ms: 25000, text: 'test',
      keyStats: {}, bigramStats: {},
    });

    const res = await request(app).get('/api/stats');

    expect(res.body.totalSessions).toBe(2);
  });

  it('returns correct bestWpm', async () => {
    addSession(db, {
      wpm: 50, accuracy: 0.9, errors: 2, characters: 100,
      duration_ms: 30000, text: 'test',
      keyStats: {}, bigramStats: {},
    });
    addSession(db, {
      wpm: 75, accuracy: 0.95, errors: 1, characters: 120,
      duration_ms: 25000, text: 'test',
      keyStats: {}, bigramStats: {},
    });
    addSession(db, {
      wpm: 60, accuracy: 0.92, errors: 3, characters: 110,
      duration_ms: 28000, text: 'test',
      keyStats: {}, bigramStats: {},
    });

    const res = await request(app).get('/api/stats');

    expect(res.body.bestWpm).toBe(75);
  });

  it('computes recentAvgWpm and recentAvgAccuracy from recent sessions', async () => {
    // Add 5 sessions with known WPMs
    for (let i = 0; i < 5; i++) {
      addSession(db, {
        wpm: 40 + i * 10, // 40, 50, 60, 70, 80
        accuracy: 0.9,
        errors: 1, characters: 100, duration_ms: 30000, text: 'test',
        keyStats: {}, bigramStats: {},
      });
    }

    const res = await request(app).get('/api/stats');

    // avg = (40+50+60+70+80)/5 = 60
    expect(res.body.recentAvgWpm).toBe(60);
    expect(res.body.recentAvgAccuracy).toBe(0.9);
  });

  it('returns top 5 weakest keys by avg time', async () => {
    addSession(db, {
      wpm: 50, accuracy: 0.9, errors: 2, characters: 100,
      duration_ms: 30000, text: 'test',
      keyStats: {
        a: { avgTime: 100, count: 5 },
        b: { avgTime: 200, count: 5 },
        c: { avgTime: 150, count: 5 },
        d: { avgTime: 300, count: 5 },
        e: { avgTime: 250, count: 5 },
        f: { avgTime: 50, count: 5 },  // fastest, should not appear in top 5
      },
      bigramStats: {},
    });

    const res = await request(app).get('/api/stats');

    expect(res.body.weakestKeys).toHaveLength(5);
    expect(res.body.weakestKeys[0].key).toBe('d');
    expect(res.body.weakestKeys[0].avgTime).toBe(300);
    expect(res.body.weakestKeys[1].key).toBe('e');
    expect(res.body.weakestKeys[4].key).toBe('a');
  });

  it('returns top 5 weakest bigrams by avg time', async () => {
    addSession(db, {
      wpm: 50, accuracy: 0.9, errors: 2, characters: 100,
      duration_ms: 30000, text: 'test',
      keyStats: {},
      bigramStats: {
        ab: { avgTime: 100, count: 3 },
        bc: { avgTime: 200, count: 3 },
        cd: { avgTime: 150, count: 3 },
        de: { avgTime: 300, count: 3 },
        ef: { avgTime: 250, count: 3 },
        fg: { avgTime: 50, count: 3 },  // fastest
      },
    });

    const res = await request(app).get('/api/stats');

    expect(res.body.weakestBigrams).toHaveLength(5);
    expect(res.body.weakestBigrams[0].bigram).toBe('de');
    expect(res.body.weakestBigrams[0].avgTime).toBe(300);
  });

  it('aggregates stats across multiple sessions', async () => {
    addSession(db, {
      wpm: 50, accuracy: 0.9, errors: 2, characters: 100,
      duration_ms: 30000, text: 'test',
      keyStats: { a: { avgTime: 100, count: 5 } },
      bigramStats: {},
    });
    addSession(db, {
      wpm: 60, accuracy: 0.95, errors: 1, characters: 120,
      duration_ms: 25000, text: 'test',
      keyStats: { a: { avgTime: 200, count: 5 } },
      bigramStats: {},
    });

    const res = await request(app).get('/api/stats');

    // Average of 100 and 200 = 150
    expect(res.body.weakestKeys[0].key).toBe('a');
    expect(res.body.weakestKeys[0].avgTime).toBe(150);
  });

  it('returns correct response shape', async () => {
    const res = await request(app).get('/api/stats');

    expect(res.body).toHaveProperty('totalSessions');
    expect(res.body).toHaveProperty('bestWpm');
    expect(res.body).toHaveProperty('recentAvgWpm');
    expect(res.body).toHaveProperty('recentAvgAccuracy');
    expect(res.body).toHaveProperty('weakestKeys');
    expect(res.body).toHaveProperty('weakestBigrams');
    expect(Array.isArray(res.body.weakestKeys)).toBe(true);
    expect(Array.isArray(res.body.weakestBigrams)).toBe(true);
  });
});
