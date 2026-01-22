import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'typeforge.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema();
  }
  return db;
}

function initSchema(): void {
  const database = db!;

  // Sessions table
  database.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wpm INTEGER NOT NULL,
      accuracy REAL NOT NULL,
      errors INTEGER NOT NULL,
      characters INTEGER NOT NULL,
      mode TEXT NOT NULL,
      text_type TEXT NOT NULL,
      timestamp INTEGER NOT NULL UNIQUE
    )
  `);

  // Key timing samples (normalized from array)
  database.exec(`
    CREATE TABLE IF NOT EXISTS key_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL,
      time_ms INTEGER NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_key_stats_key ON key_stats(key)`);

  // Bigram timing samples (normalized from array)
  database.exec(`
    CREATE TABLE IF NOT EXISTS bigram_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bigram TEXT NOT NULL,
      time_ms INTEGER NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_bigram_stats_bigram ON bigram_stats(bigram)`);

  // Settings (single row)
  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      target_wpm INTEGER DEFAULT 85,
      speed_duration INTEGER DEFAULT 30,
      endurance_duration INTEGER DEFAULT 3,
      burst_words INTEGER DEFAULT 5,
      daily_goal INTEGER DEFAULT 10,
      ai_endpoint TEXT DEFAULT 'http://localhost:1234/v1'
    )
  `);

  // Initialize settings row if not exists
  database.exec(`INSERT OR IGNORE INTO settings (id) VALUES (1)`);

  // App state (best WPM tracking)
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      best_wpm INTEGER DEFAULT 0
    )
  `);

  // Initialize app_state row if not exists
  database.exec(`INSERT OR IGNORE INTO app_state (id) VALUES (1)`);

  // Chat messages table for AI conversation
  database.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_chat_timestamp ON chat_messages(timestamp)`);

  // Training plan state (single row)
  database.exec(`
    CREATE TABLE IF NOT EXISTS training_plan (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      sessions_since_update INTEGER DEFAULT 0,
      current_difficulty TEXT DEFAULT 'medium' CHECK (current_difficulty IN ('easy', 'medium', 'hard')),
      current_theme TEXT DEFAULT 'general',
      weak_keys TEXT DEFAULT '[]',
      weak_bigrams TEXT DEFAULT '[]',
      practice_mode TEXT DEFAULT 'words' CHECK (practice_mode IN ('words', 'quotes')),
      system_prompt TEXT DEFAULT 'You are an expert typing coach. Help improve typing speed and accuracy. Be concise and actionable. Format your responses using Markdown for better readability (use **bold** for emphasis, bullet lists, headers, etc.).',
      last_updated INTEGER DEFAULT 0
    )
  `);
  database.exec(`INSERT OR IGNORE INTO training_plan (id) VALUES (1)`);

  // Migrate existing system prompts to include Markdown instruction
  const OLD_PROMPT = 'You are an expert typing coach. Help improve typing speed and accuracy. Be concise and actionable.';
  const NEW_PROMPT = 'You are an expert typing coach. Help improve typing speed and accuracy. Be concise and actionable. Format your responses using Markdown for better readability (use **bold** for emphasis, bullet lists, headers, etc.).';

  database.prepare(`
    UPDATE training_plan
    SET system_prompt = ?
    WHERE id = 1 AND system_prompt = ?
  `).run(NEW_PROMPT, OLD_PROMPT);
}

// Session operations
export function getAllSessions() {
  return getDb().prepare(`
    SELECT wpm, accuracy, errors, characters, mode, text_type as textType, timestamp
    FROM sessions
    ORDER BY timestamp ASC
  `).all();
}

export function addSession(session: {
  wpm: number;
  accuracy: number;
  errors: number;
  characters: number;
  mode: string;
  textType: string;
  timestamp: number;
}) {
  const stmt = getDb().prepare(`
    INSERT INTO sessions (wpm, accuracy, errors, characters, mode, text_type, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(session.wpm, session.accuracy, session.errors, session.characters, session.mode, session.textType, session.timestamp);
}

// Key stats operations
export function getKeyStats(): Record<string, { times: number[]; errors: number }> {
  const rows = getDb().prepare(`
    SELECT key, time_ms
    FROM key_stats
    ORDER BY id DESC
  `).all() as { key: string; time_ms: number }[];

  const stats: Record<string, { times: number[]; errors: number }> = {};
  for (const row of rows) {
    if (!stats[row.key]) {
      stats[row.key] = { times: [], errors: 0 };
    }
    // Keep only last 100 per key
    if (stats[row.key].times.length < 100) {
      stats[row.key].times.unshift(row.time_ms);
    }
  }
  return stats;
}

export function addKeyStats(keyTimes: Record<string, number[]>) {
  const database = getDb();
  const stmt = database.prepare(`INSERT INTO key_stats (key, time_ms) VALUES (?, ?)`);

  const insertMany = database.transaction((entries: [string, number[]][]) => {
    for (const [key, times] of entries) {
      for (const time of times) {
        stmt.run(key, time);
      }
    }
  });

  insertMany(Object.entries(keyTimes));

  // Cleanup old entries - keep only last 100 per key
  const keys = Object.keys(keyTimes);
  for (const key of keys) {
    const count = database.prepare(`SELECT COUNT(*) as count FROM key_stats WHERE key = ?`).get(key) as { count: number };
    if (count.count > 100) {
      database.prepare(`
        DELETE FROM key_stats
        WHERE key = ? AND id NOT IN (
          SELECT id FROM key_stats WHERE key = ? ORDER BY id DESC LIMIT 100
        )
      `).run(key, key);
    }
  }
}

// Bigram stats operations
export function getBigramStats(): Record<string, number[]> {
  const rows = getDb().prepare(`
    SELECT bigram, time_ms
    FROM bigram_stats
    ORDER BY id DESC
  `).all() as { bigram: string; time_ms: number }[];

  const stats: Record<string, number[]> = {};
  for (const row of rows) {
    if (!stats[row.bigram]) {
      stats[row.bigram] = [];
    }
    // Keep only last 50 per bigram
    if (stats[row.bigram].length < 50) {
      stats[row.bigram].unshift(row.time_ms);
    }
  }
  return stats;
}

export function addBigramStats(bigramTimes: Record<string, number[]>) {
  const database = getDb();
  const stmt = database.prepare(`INSERT INTO bigram_stats (bigram, time_ms) VALUES (?, ?)`);

  const insertMany = database.transaction((entries: [string, number[]][]) => {
    for (const [bigram, times] of entries) {
      for (const time of times) {
        stmt.run(bigram, time);
      }
    }
  });

  insertMany(Object.entries(bigramTimes));

  // Cleanup old entries - keep only last 50 per bigram
  const bigrams = Object.keys(bigramTimes);
  for (const bigram of bigrams) {
    const count = database.prepare(`SELECT COUNT(*) as count FROM bigram_stats WHERE bigram = ?`).get(bigram) as { count: number };
    if (count.count > 50) {
      database.prepare(`
        DELETE FROM bigram_stats
        WHERE bigram = ? AND id NOT IN (
          SELECT id FROM bigram_stats WHERE bigram = ? ORDER BY id DESC LIMIT 50
        )
      `).run(bigram, bigram);
    }
  }
}

// Settings operations
export function getSettings() {
  const row = getDb().prepare(`
    SELECT target_wpm as targetWpm, speed_duration as speedDuration,
           endurance_duration as enduranceDuration, burst_words as burstWords,
           daily_goal as dailyGoal, ai_endpoint as aiEndpoint
    FROM settings WHERE id = 1
  `).get() as {
    targetWpm: number;
    speedDuration: number;
    enduranceDuration: number;
    burstWords: number;
    dailyGoal: number;
    aiEndpoint: string;
  };
  return row;
}

export function updateSettings(settings: Partial<{
  targetWpm: number;
  speedDuration: number;
  enduranceDuration: number;
  burstWords: number;
  dailyGoal: number;
  aiEndpoint: string;
}>) {
  const database = getDb();
  const updates: string[] = [];
  const values: (number | string)[] = [];

  if (settings.targetWpm !== undefined) {
    updates.push('target_wpm = ?');
    values.push(settings.targetWpm);
  }
  if (settings.speedDuration !== undefined) {
    updates.push('speed_duration = ?');
    values.push(settings.speedDuration);
  }
  if (settings.enduranceDuration !== undefined) {
    updates.push('endurance_duration = ?');
    values.push(settings.enduranceDuration);
  }
  if (settings.burstWords !== undefined) {
    updates.push('burst_words = ?');
    values.push(settings.burstWords);
  }
  if (settings.dailyGoal !== undefined) {
    updates.push('daily_goal = ?');
    values.push(settings.dailyGoal);
  }
  if (settings.aiEndpoint !== undefined) {
    updates.push('ai_endpoint = ?');
    values.push(settings.aiEndpoint);
  }

  if (updates.length > 0) {
    database.prepare(`UPDATE settings SET ${updates.join(', ')} WHERE id = 1`).run(...values);
  }
}

// App state operations
export function getBestWpm(): number {
  const row = getDb().prepare(`SELECT best_wpm FROM app_state WHERE id = 1`).get() as { best_wpm: number };
  return row?.best_wpm ?? 0;
}

export function updateBestWpm(wpm: number) {
  getDb().prepare(`UPDATE app_state SET best_wpm = ? WHERE id = 1`).run(wpm);
}

// Clear all data
export function clearAllData() {
  const database = getDb();
  database.exec(`DELETE FROM sessions`);
  database.exec(`DELETE FROM key_stats`);
  database.exec(`DELETE FROM bigram_stats`);
  database.exec(`UPDATE settings SET
    target_wpm = 85,
    speed_duration = 30,
    endurance_duration = 3,
    burst_words = 5,
    daily_goal = 10,
    ai_endpoint = 'http://localhost:1234/v1'
    WHERE id = 1`);
  database.exec(`UPDATE app_state SET best_wpm = 0 WHERE id = 1`);
}

// Import data (for migration from localStorage)
export function importData(data: {
  sessions: Array<{
    wpm: number;
    accuracy: number;
    errors: number;
    characters: number;
    mode: string;
    textType: string;
    timestamp: number;
  }>;
  keyStats: Record<string, { times: number[]; errors: number }>;
  bigramStats: Record<string, number[]>;
  bestWpm: number;
  settings: {
    targetWpm: number;
    speedDuration: number;
    enduranceDuration: number;
    burstWords: number;
    dailyGoal: number;
    aiEndpoint: string;
  };
}) {
  const database = getDb();

  // Import sessions (avoid duplicates by timestamp)
  const existingTimestamps = new Set(
    (database.prepare(`SELECT timestamp FROM sessions`).all() as { timestamp: number }[])
      .map(r => r.timestamp)
  );

  const sessionStmt = database.prepare(`
    INSERT INTO sessions (wpm, accuracy, errors, characters, mode, text_type, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSessions = database.transaction((sessions: typeof data.sessions) => {
    for (const s of sessions) {
      if (!existingTimestamps.has(s.timestamp)) {
        sessionStmt.run(s.wpm, s.accuracy, s.errors, s.characters, s.mode, s.textType, s.timestamp);
      }
    }
  });

  insertSessions(data.sessions);

  // Import key stats
  const keyStmt = database.prepare(`INSERT INTO key_stats (key, time_ms) VALUES (?, ?)`);
  const insertKeys = database.transaction((entries: [string, { times: number[] }][]) => {
    for (const [key, stats] of entries) {
      for (const time of stats.times) {
        keyStmt.run(key, time);
      }
    }
  });
  insertKeys(Object.entries(data.keyStats));

  // Import bigram stats
  const bigramStmt = database.prepare(`INSERT INTO bigram_stats (bigram, time_ms) VALUES (?, ?)`);
  const insertBigrams = database.transaction((entries: [string, number[]][]) => {
    for (const [bigram, times] of entries) {
      for (const time of times) {
        bigramStmt.run(bigram, time);
      }
    }
  });
  insertBigrams(Object.entries(data.bigramStats));

  // Update best WPM if higher
  const currentBest = getBestWpm();
  if (data.bestWpm > currentBest) {
    updateBestWpm(data.bestWpm);
  }

  // Update settings
  updateSettings(data.settings);

  return { sessionsImported: data.sessions.filter(s => !existingTimestamps.has(s.timestamp)).length };
}

// Chat message operations
export function getChatMessages(limit: number = 50): Array<{ id: number; role: string; content: string; timestamp: number }> {
  return getDb().prepare(`
    SELECT id, role, content, timestamp
    FROM chat_messages
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(limit) as Array<{ id: number; role: string; content: string; timestamp: number }>;
}

export function addChatMessage(role: string, content: string): void {
  getDb().prepare(`
    INSERT INTO chat_messages (role, content, timestamp)
    VALUES (?, ?, ?)
  `).run(role, content, Date.now());
}

export function clearChatHistory(): void {
  getDb().exec(`DELETE FROM chat_messages`);
}

// Training plan operations
export function getTrainingPlan(): {
  sessionsSinceUpdate: number;
  currentDifficulty: string;
  currentTheme: string;
  weakKeys: string[];
  weakBigrams: string[];
  practiceMode: string;
  systemPrompt: string;
  lastUpdated: number;
} {
  const row = getDb().prepare(`
    SELECT sessions_since_update as sessionsSinceUpdate,
           current_difficulty as currentDifficulty,
           current_theme as currentTheme,
           weak_keys as weakKeys,
           weak_bigrams as weakBigrams,
           practice_mode as practiceMode,
           system_prompt as systemPrompt,
           last_updated as lastUpdated
    FROM training_plan WHERE id = 1
  `).get() as {
    sessionsSinceUpdate: number;
    currentDifficulty: string;
    currentTheme: string;
    weakKeys: string;
    weakBigrams: string;
    practiceMode: string;
    systemPrompt: string;
    lastUpdated: number;
  };

  return {
    ...row,
    weakKeys: JSON.parse(row.weakKeys || '[]'),
    weakBigrams: JSON.parse(row.weakBigrams || '[]')
  };
}

export function updateTrainingPlan(plan: {
  sessionsSinceUpdate?: number;
  currentDifficulty?: string;
  currentTheme?: string;
  weakKeys?: string[];
  weakBigrams?: string[];
  practiceMode?: string;
  systemPrompt?: string;
  lastUpdated?: number;
}): void {
  const database = getDb();
  const updates: string[] = [];
  const values: (number | string)[] = [];

  if (plan.sessionsSinceUpdate !== undefined) {
    updates.push('sessions_since_update = ?');
    values.push(plan.sessionsSinceUpdate);
  }
  if (plan.currentDifficulty !== undefined) {
    updates.push('current_difficulty = ?');
    values.push(plan.currentDifficulty);
  }
  if (plan.currentTheme !== undefined) {
    updates.push('current_theme = ?');
    values.push(plan.currentTheme);
  }
  if (plan.weakKeys !== undefined) {
    updates.push('weak_keys = ?');
    values.push(JSON.stringify(plan.weakKeys));
  }
  if (plan.weakBigrams !== undefined) {
    updates.push('weak_bigrams = ?');
    values.push(JSON.stringify(plan.weakBigrams));
  }
  if (plan.practiceMode !== undefined) {
    updates.push('practice_mode = ?');
    values.push(plan.practiceMode);
  }
  if (plan.systemPrompt !== undefined) {
    updates.push('system_prompt = ?');
    values.push(plan.systemPrompt);
  }
  if (plan.lastUpdated !== undefined) {
    updates.push('last_updated = ?');
    values.push(plan.lastUpdated);
  }

  if (updates.length > 0) {
    database.prepare(`UPDATE training_plan SET ${updates.join(', ')} WHERE id = 1`).run(...values);
  }
}

export function incrementSessionCount(): number {
  const database = getDb();
  database.prepare(`UPDATE training_plan SET sessions_since_update = sessions_since_update + 1 WHERE id = 1`).run();
  const row = database.prepare(`SELECT sessions_since_update FROM training_plan WHERE id = 1`).get() as { sessions_since_update: number };
  return row.sessions_since_update;
}
