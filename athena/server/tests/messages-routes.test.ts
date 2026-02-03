import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import express from 'express';
import { createDb } from '../src/db.js';
import { createMessagesRouter } from '../src/routes/messages.js';
import { addMessage } from '../src/repositories/messages.js';

let db: Database.Database;
let app: express.Express;

beforeEach(() => {
  db = createDb(':memory:');
  app = express();
  app.use(express.json());
  app.use('/api', createMessagesRouter(db));
});

afterEach(() => {
  db.close();
});

describe('GET /api/messages', () => {
  it('returns empty array when no messages', async () => {
    const res = await request(app).get('/api/messages');

    expect(res.status).toBe(200);
    expect(res.body.messages).toEqual([]);
    expect(res.body.hasMore).toBe(false);
  });

  it('returns messages in chronological order', async () => {
    addMessage(db, { role: 'user', content: 'first' });
    addMessage(db, { role: 'assistant', content: 'second' });
    addMessage(db, { role: 'user', content: 'third' });

    const res = await request(app).get('/api/messages');

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(3);
    expect(res.body.messages[0].content).toBe('first');
    expect(res.body.messages[1].content).toBe('second');
    expect(res.body.messages[2].content).toBe('third');
  });

  it('uses default limit of 20', async () => {
    for (let i = 0; i < 25; i++) {
      addMessage(db, { role: 'user', content: `msg-${i}` });
    }

    const res = await request(app).get('/api/messages');

    expect(res.body.messages).toHaveLength(20);
    expect(res.body.hasMore).toBe(true);
  });

  it('respects custom limit', async () => {
    for (let i = 0; i < 10; i++) {
      addMessage(db, { role: 'user', content: `msg-${i}` });
    }

    const res = await request(app).get('/api/messages?limit=5');

    expect(res.body.messages).toHaveLength(5);
    expect(res.body.hasMore).toBe(true);
  });

  it('caps limit at 100', async () => {
    for (let i = 0; i < 150; i++) {
      addMessage(db, { role: 'user', content: `msg-${i}` });
    }

    const res = await request(app).get('/api/messages?limit=200');

    expect(res.body.messages).toHaveLength(100);
    expect(res.body.hasMore).toBe(true);
  });

  it('returns 400 for invalid limit', async () => {
    const res = await request(app).get('/api/messages?limit=abc');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 for negative limit', async () => {
    const res = await request(app).get('/api/messages?limit=-5');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('supports before parameter for pagination', async () => {
    // Insert messages with explicit different timestamps
    db.prepare(
      "INSERT INTO messages (role, content, timestamp) VALUES ('user', 'old', 1000)"
    ).run();
    db.prepare(
      "INSERT INTO messages (role, content, timestamp) VALUES ('user', 'mid', 2000)"
    ).run();
    db.prepare(
      "INSERT INTO messages (role, content, timestamp) VALUES ('user', 'new', 3000)"
    ).run();

    // Get messages before timestamp 3000
    const res = await request(app).get('/api/messages?before=3000&limit=10');

    expect(res.body.messages).toHaveLength(2);
    expect(res.body.messages[0].content).toBe('old');
    expect(res.body.messages[1].content).toBe('mid');
    expect(res.body.hasMore).toBe(false);
  });

  it('returns hasMore correctly with pagination', async () => {
    // Insert 5 messages with distinct timestamps
    // msg-0 at 1000, msg-1 at 2000, ..., msg-4 at 5000
    for (let i = 0; i < 5; i++) {
      db.prepare(
        "INSERT INTO messages (role, content, timestamp) VALUES ('user', ?, ?)"
      ).run(`msg-${i}`, 1000 + i * 1000);
    }

    // Get 2 most recent (limit=2) — should be msg-3, msg-4
    const firstPage = await request(app).get('/api/messages?limit=2');
    expect(firstPage.body.messages).toHaveLength(2);
    expect(firstPage.body.hasMore).toBe(true);
    expect(firstPage.body.messages[0].content).toBe('msg-3');
    expect(firstPage.body.messages[1].content).toBe('msg-4');

    // Use oldest timestamp from first page (msg-3 at 4000) to get older
    const beforeTs = firstPage.body.messages[0].timestamp;
    const secondPage = await request(app).get(`/api/messages?before=${beforeTs}&limit=2`);
    expect(secondPage.body.messages).toHaveLength(2);
    expect(secondPage.body.hasMore).toBe(true);
    expect(secondPage.body.messages[0].content).toBe('msg-1');
    expect(secondPage.body.messages[1].content).toBe('msg-2');

    // Get third page (msg-0)
    const beforeTs2 = secondPage.body.messages[0].timestamp;
    const thirdPage = await request(app).get(`/api/messages?before=${beforeTs2}&limit=2`);
    expect(thirdPage.body.messages).toHaveLength(1);
    expect(thirdPage.body.hasMore).toBe(false);
    expect(thirdPage.body.messages[0].content).toBe('msg-0');
  });

  it('includes session_id in messages', async () => {
    // Create a session first
    db.prepare(
      "INSERT INTO sessions (wpm, accuracy, errors, characters, duration_ms, text) VALUES (50, 0.9, 2, 100, 30000, 'test')"
    ).run();

    addMessage(db, { role: 'assistant', content: 'with session', sessionId: 1 });
    addMessage(db, { role: 'user', content: 'no session' });

    const res = await request(app).get('/api/messages');

    expect(res.body.messages[0].session_id).toBe(1);
    expect(res.body.messages[1].session_id).toBeNull();
  });

  it('returns 400 for invalid before timestamp', async () => {
    const res = await request(app).get('/api/messages?before=invalid');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});
