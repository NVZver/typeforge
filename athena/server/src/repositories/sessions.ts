import type Database from 'better-sqlite3';
import type { SessionRequest, SessionDetailResponse } from '@typeforge/types';

export function addSession(
  db: Database.Database,
  data: SessionRequest
): { id: number } {
  const insertSession = db.prepare(`
    INSERT INTO sessions (wpm, accuracy, errors, characters, duration_ms, text)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertKeyStat = db.prepare(`
    INSERT INTO key_stats (key, avg_time_ms, sample_count, session_id)
    VALUES (?, ?, ?, ?)
  `);
  const insertBigramStat = db.prepare(`
    INSERT INTO bigram_stats (bigram, avg_time_ms, sample_count, session_id)
    VALUES (?, ?, ?, ?)
  `);

  const run = db.transaction(() => {
    const result = insertSession.run(
      data.wpm, data.accuracy, data.errors,
      data.characters, data.duration_ms, data.text
    );
    const sessionId = Number(result.lastInsertRowid);

    for (const [key, stat] of Object.entries(data.keyStats)) {
      insertKeyStat.run(key, stat.avgTime, stat.count, sessionId);
    }
    for (const [bigram, stat] of Object.entries(data.bigramStats)) {
      insertBigramStat.run(bigram, stat.avgTime, stat.count, sessionId);
    }

    return { id: sessionId };
  });

  return run();
}

export function getSession(
  db: Database.Database,
  id: number
): SessionDetailResponse | null {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  if (!session) return null;

  const keyStats = db.prepare('SELECT * FROM key_stats WHERE session_id = ?').all(id);
  const bigramStats = db.prepare('SELECT * FROM bigram_stats WHERE session_id = ?').all(id);

  return {
    session: session as SessionDetailResponse['session'],
    keyStats: keyStats as SessionDetailResponse['keyStats'],
    bigramStats: bigramStats as SessionDetailResponse['bigramStats'],
  };
}
