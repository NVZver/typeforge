import type Database from 'better-sqlite3';

export function getWeakestKeys(
  db: Database.Database,
  limit: number = 5
): Array<{ key: string; avgTime: number }> {
  return db.prepare(`
    SELECT key, AVG(avg_time_ms) as avgTime
    FROM key_stats
    GROUP BY key
    ORDER BY avgTime DESC
    LIMIT ?
  `).all(limit) as Array<{ key: string; avgTime: number }>;
}

export function getWeakestBigrams(
  db: Database.Database,
  limit: number = 5
): Array<{ bigram: string; avgTime: number }> {
  return db.prepare(`
    SELECT bigram, AVG(avg_time_ms) as avgTime
    FROM bigram_stats
    GROUP BY bigram
    ORDER BY avgTime DESC
    LIMIT ?
  `).all(limit) as Array<{ bigram: string; avgTime: number }>;
}

export function getRecentAverages(
  db: Database.Database,
  count: number = 10
): { avgWpm: number; avgAccuracy: number } {
  const row = db.prepare(`
    SELECT
      COALESCE(AVG(wpm), 0) as avgWpm,
      COALESCE(AVG(accuracy), 0) as avgAccuracy
    FROM (
      SELECT wpm, accuracy FROM sessions
      ORDER BY timestamp DESC
      LIMIT ?
    )
  `).get(count) as { avgWpm: number; avgAccuracy: number };
  return row;
}

export function getTotalSessions(db: Database.Database): number {
  const row = db.prepare('SELECT COUNT(*) as count FROM sessions').get() as { count: number };
  return row.count;
}

export function getBestWpm(db: Database.Database): number {
  const row = db.prepare('SELECT COALESCE(MAX(wpm), 0) as best FROM sessions').get() as { best: number };
  return row.best;
}
