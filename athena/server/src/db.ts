import Database from 'better-sqlite3';

export function createDb(dbPath: string = 'typeforge.db'): Database.Database {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema(db);
  return db;
}

let _db: Database.Database | null = null;

export function getDb(dbPath?: string): Database.Database {
  if (!_db) {
    _db = createDb(dbPath);
  }
  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wpm REAL NOT NULL,
      accuracy REAL NOT NULL,
      errors INTEGER NOT NULL,
      characters INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      text TEXT NOT NULL,
      timestamp INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      session_id INTEGER,
      timestamp INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS key_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL,
      avg_time_ms REAL NOT NULL,
      sample_count INTEGER NOT NULL,
      session_id INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS bigram_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bigram TEXT NOT NULL,
      avg_time_ms REAL NOT NULL,
      sample_count INTEGER NOT NULL,
      session_id INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_key_stats_key ON key_stats(key);
    CREATE INDEX IF NOT EXISTS idx_key_stats_session_id ON key_stats(session_id);
    CREATE INDEX IF NOT EXISTS idx_bigram_stats_bigram ON bigram_stats(bigram);
    CREATE INDEX IF NOT EXISTS idx_bigram_stats_session_id ON bigram_stats(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
  `);
}
