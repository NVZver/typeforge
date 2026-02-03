import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import express from 'express';
import { createDb } from '../src/db.js';
import { createSessionRouter } from '../src/routes/session.js';

let db: Database.Database;
let app: express.Express;

const validPayload = {
  wpm: 45.5,
  accuracy: 0.92,
  errors: 3,
  characters: 100,
  duration_ms: 30000,
  text: 'The quick brown fox.',
  keyStats: { t: { avgTime: 120, count: 5 }, h: { avgTime: 110, count: 3 } },
  bigramStats: { th: { avgTime: 200, count: 3 }, he: { avgTime: 180, count: 2 } },
};

beforeEach(() => {
  db = createDb(':memory:');
  app = express();
  app.use(express.json());
  app.use('/api', createSessionRouter(db));
});

afterEach(() => {
  db.close();
});

describe('POST /api/session', () => {
  it('returns 201 with valid payload', async () => {
    const res = await request(app)
      .post('/api/session')
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(typeof res.body.id).toBe('number');
    expect(res.body.id).toBeGreaterThan(0);
  });

  it('saves session and all stats to DB', async () => {
    const res = await request(app)
      .post('/api/session')
      .send(validPayload);

    const sessionId = res.body.id;

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as any;
    expect(session.wpm).toBe(45.5);
    expect(session.accuracy).toBe(0.92);
    expect(session.text).toBe('The quick brown fox.');

    const keyStats = db.prepare('SELECT * FROM key_stats WHERE session_id = ?').all(sessionId);
    expect(keyStats).toHaveLength(2);

    const bigramStats = db.prepare('SELECT * FROM bigram_stats WHERE session_id = ?').all(sessionId);
    expect(bigramStats).toHaveLength(2);
  });

  it('returns 400 when missing required fields', async () => {
    const res = await request(app)
      .post('/api/session')
      .send({ wpm: 50 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when wpm is not a number', async () => {
    const res = await request(app)
      .post('/api/session')
      .send({ ...validPayload, wpm: 'fast' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('wpm');
  });

  it('returns 400 when accuracy is out of range', async () => {
    const res = await request(app)
      .post('/api/session')
      .send({ ...validPayload, accuracy: 1.5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('accuracy');
  });

  it('returns 400 when errors is not an integer', async () => {
    const res = await request(app)
      .post('/api/session')
      .send({ ...validPayload, errors: 3.5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('errors');
  });

  it('returns 400 when text is empty', async () => {
    const res = await request(app)
      .post('/api/session')
      .send({ ...validPayload, text: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('text');
  });

  it('returns 400 when keyStats is not an object', async () => {
    const res = await request(app)
      .post('/api/session')
      .send({ ...validPayload, keyStats: [{ key: 'a', avgTime: 100, count: 1 }] });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('keyStats');
  });

  it('returns 400 when keyStats entry missing avgTime', async () => {
    const res = await request(app)
      .post('/api/session')
      .send({ ...validPayload, keyStats: { a: { count: 5 } } });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('keyStats.a');
  });

  it('returns 400 when wpm is negative', async () => {
    const res = await request(app)
      .post('/api/session')
      .send({ ...validPayload, wpm: -5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('wpm');
  });

  it('returns 400 when wpm is NaN', async () => {
    const res = await request(app)
      .post('/api/session')
      .send({ ...validPayload, wpm: NaN });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('wpm');
  });

  it('returns 400 when wpm is Infinity', async () => {
    const res = await request(app)
      .post('/api/session')
      .send({ ...validPayload, wpm: Infinity });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('wpm');
  });

  it('returns 400 when text exceeds max length', async () => {
    const res = await request(app)
      .post('/api/session')
      .send({ ...validPayload, text: 'x'.repeat(10001) });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('text');
  });

  it('returns 400 when keyStats has too many entries', async () => {
    const tooManyKeyStats: Record<string, { avgTime: number; count: number }> = {};
    for (let i = 0; i < 200; i++) {
      tooManyKeyStats[`key${i}`] = { avgTime: 100, count: 1 };
    }

    const res = await request(app)
      .post('/api/session')
      .send({ ...validPayload, keyStats: tooManyKeyStats });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('keyStats');
  });

  it('returns 400 when bigramStats has too many entries', async () => {
    const tooManyBigramStats: Record<string, { avgTime: number; count: number }> = {};
    for (let i = 0; i < 600; i++) {
      tooManyBigramStats[`bg${i}`] = { avgTime: 100, count: 1 };
    }

    const res = await request(app)
      .post('/api/session')
      .send({ ...validPayload, bigramStats: tooManyBigramStats });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('bigramStats');
  });

  it('accepts empty keyStats and bigramStats objects', async () => {
    const res = await request(app)
      .post('/api/session')
      .send({ ...validPayload, keyStats: {}, bigramStats: {} });

    expect(res.status).toBe(201);
  });

  it('returns 400 when keyStats avgTime is negative', async () => {
    const res = await request(app)
      .post('/api/session')
      .send({ ...validPayload, keyStats: { a: { avgTime: -50, count: 5 } } });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('avgTime');
  });

  it('returns 400 when keyStats count is negative', async () => {
    const res = await request(app)
      .post('/api/session')
      .send({ ...validPayload, keyStats: { a: { avgTime: 100, count: -1 } } });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('count');
  });
});

describe('GET /api/session/:id', () => {
  it('returns session with stats for valid ID', async () => {
    const createRes = await request(app)
      .post('/api/session')
      .send(validPayload);

    const sessionId = createRes.body.id;

    const res = await request(app).get(`/api/session/${sessionId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('session');
    expect(res.body).toHaveProperty('keyStats');
    expect(res.body).toHaveProperty('bigramStats');
    expect(res.body.session.id).toBe(sessionId);
    expect(res.body.session.wpm).toBe(45.5);
    expect(res.body.keyStats).toHaveLength(2);
    expect(res.body.bigramStats).toHaveLength(2);
  });

  it('returns 404 for non-existent ID', async () => {
    const res = await request(app).get('/api/session/9999');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 for invalid ID format', async () => {
    const res = await request(app).get('/api/session/abc');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 for negative ID', async () => {
    const res = await request(app).get('/api/session/-1');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});
