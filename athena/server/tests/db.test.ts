import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDb } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Database initialization', () => {
  it('initializes without error', () => {
    const db = createDb(':memory:');
    expect(db).toBeDefined();
    db.close();
  });

  it('creates all 4 tables', () => {
    const db = createDb(':memory:');
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all() as { name: string }[];
    const names = tables.map(t => t.name).sort();
    expect(names).toEqual(['bigram_stats', 'key_stats', 'messages', 'sessions']);
    db.close();
  });

  it('creates expected indexes', () => {
    const db = createDb(':memory:');
    const indexes = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'
    `).all() as { name: string }[];
    const names = indexes.map(i => i.name).sort();
    expect(names).toEqual([
      'idx_bigram_stats_bigram',
      'idx_bigram_stats_session_id',
      'idx_key_stats_key',
      'idx_key_stats_session_id',
      'idx_messages_timestamp',
    ]);
    db.close();
  });

  it('sets WAL mode (in-memory reports "memory")', () => {
    // In-memory DBs report "memory" instead of "wal", but the pragma is still issued.
    // Use a temp file to verify WAL mode is actually set on disk DBs.
    // fs and path imported at top of file
    const tmpPath = path.join(__dirname, '__test_wal.db');
    try {
      const db = createDb(tmpPath);
      const result = db.pragma('journal_mode') as { journal_mode: string }[];
      expect(result[0].journal_mode).toBe('wal');
      db.close();
    } finally {
      for (const ext of ['', '-wal', '-shm']) {
        try { fs.unlinkSync(tmpPath + ext); } catch {}
      }
    }
  });
});
