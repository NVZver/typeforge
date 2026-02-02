import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import type { Express } from 'express';

// Mock the LMStudio client
vi.mock('../src/llm/lmstudio-client.js', () => ({
  checkHealth: vi.fn().mockResolvedValue({ status: 'connected', model: 'test', error: null }),
  streamChatCompletion: vi.fn(),
}));

import { streamChatCompletion } from '../src/llm/lmstudio-client.js';

const mockStream = streamChatCompletion as ReturnType<typeof vi.fn>;

function makeAsyncGenerator(tokens: string[]): AsyncGenerator<string> {
  return (async function* () {
    for (const token of tokens) {
      yield token;
    }
  })();
}

let db: Database.Database;
let app: Express;

beforeEach(() => {
  db = createDb(':memory:');
  app = createApp(db);
  vi.clearAllMocks();
});

afterEach(() => {
  db.close();
});

function parseSSE(text: string): Array<{ event: string; data: unknown }> {
  const events: Array<{ event: string; data: unknown }> = [];
  const blocks = text.split('\n\n').filter(Boolean);
  for (const block of blocks) {
    const lines = block.split('\n');
    let event = '';
    let data = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) event = line.slice(7);
      if (line.startsWith('data: ')) data = line.slice(6);
    }
    if (event && data) {
      events.push({ event, data: JSON.parse(data) });
    }
  }
  return events;
}

describe('POST /api/chat', () => {
  it('saves user message to DB when message provided', async () => {
    mockStream.mockReturnValue(makeAsyncGenerator(['Hello']));

    await request(app)
      .post('/api/chat')
      .send({ message: 'Hi Athena' })
      .expect(200);

    const row = db.prepare("SELECT * FROM messages WHERE role = 'user'").get() as any;
    expect(row.content).toBe('Hi Athena');
  });

  it('sets correct SSE headers', async () => {
    mockStream.mockReturnValue(makeAsyncGenerator(['OK']));

    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'test' });

    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('streams tokens as text events', async () => {
    mockStream.mockReturnValue(makeAsyncGenerator(['Hello', ' world']));

    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'test' });

    const events = parseSSE(res.text);
    const textEvents = events.filter(e => e.event === 'text');
    expect(textEvents).toEqual([
      { event: 'text', data: { token: 'Hello' } },
      { event: 'text', data: { token: ' world' } },
    ]);
  });

  it('sends done event when no action found', async () => {
    mockStream.mockReturnValue(makeAsyncGenerator(['Just a response.']));

    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'test' });

    const events = parseSSE(res.text);
    const doneEvents = events.filter(e => e.event === 'done');
    expect(doneEvents).toHaveLength(1);
  });

  it('extracts action and sends action event, strips markers from saved message', async () => {
    const responseText = 'Try this.\n[ACTION:typing_session]The quick brown fox.[/ACTION]';
    // Yield in two parts
    mockStream.mockReturnValue(makeAsyncGenerator([responseText]));

    const res = await request(app)
      .post('/api/chat')
      .send({ message: "let's practice" });

    const events = parseSSE(res.text);
    const actionEvent = events.find(e => e.event === 'action');
    expect(actionEvent).toBeDefined();
    expect(actionEvent!.data).toEqual({
      type: 'start_typing_session',
      text: 'The quick brown fox.',
    });

    // Verify saved message has markers stripped
    const saved = db.prepare("SELECT content FROM messages WHERE role = 'assistant'").get() as any;
    expect(saved.content).toBe('Try this.');
  });

  it('saves both user and assistant messages after successful chat', async () => {
    mockStream.mockReturnValue(makeAsyncGenerator(['Response']));

    await request(app)
      .post('/api/chat')
      .send({ message: 'Hello' });

    const messages = db.prepare('SELECT role, content FROM messages ORDER BY id').all() as any[];
    expect(messages).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Response' },
    ]);
  });

  it('assembles context with greeting variant', async () => {
    mockStream.mockReturnValue(makeAsyncGenerator(['Welcome!']));

    await request(app)
      .post('/api/chat')
      .send({ trigger: 'greeting' });

    // Should not save a user message for greeting
    const userMsgs = db.prepare("SELECT * FROM messages WHERE role = 'user'").all();
    expect(userMsgs).toHaveLength(0);

    // Should save assistant message
    const assistantMsgs = db.prepare("SELECT * FROM messages WHERE role = 'assistant'").all();
    expect(assistantMsgs).toHaveLength(1);
  });

  it('links sessionId to assistant message on session_complete', async () => {
    // First create a session to have a valid ID
    const sessionResult = db.prepare(
      "INSERT INTO sessions (wpm, accuracy, errors, characters, duration_ms, text) VALUES (50, 0.95, 2, 100, 30000, 'test')"
    ).run();
    const sessionId = Number(sessionResult.lastInsertRowid);

    mockStream.mockReturnValue(makeAsyncGenerator(['Good job!']));

    await request(app)
      .post('/api/chat')
      .send({
        trigger: 'session_complete',
        sessionData: { wpm: 50, accuracy: 0.95, errors: 2, characters: 100, duration_ms: 30000, text: 'test' },
        sessionId,
      });

    const msg = db.prepare("SELECT session_id FROM messages WHERE role = 'assistant'").get() as any;
    expect(msg.session_id).toBe(sessionId);
  });

  it('sends error event on LMStudio connection error', async () => {
    mockStream.mockImplementation(async function* () {
      throw new Error('fetch failed');
    });

    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'test' });

    const events = parseSSE(res.text);
    const errorEvent = events.find(e => e.event === 'error');
    expect(errorEvent).toBeDefined();
    expect((errorEvent!.data as any).code).toBe('connection_error');
  });

  it('sends error event on timeout', async () => {
    mockStream.mockImplementation(async function* () {
      throw new Error('LMStudio request timed out');
    });

    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'test' });

    const events = parseSSE(res.text);
    const errorEvent = events.find(e => e.event === 'error');
    expect(errorEvent).toBeDefined();
    expect((errorEvent!.data as any).code).toBe('timeout');
  });
});
