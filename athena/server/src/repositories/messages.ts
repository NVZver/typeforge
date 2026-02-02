import type Database from 'better-sqlite3';
import type { Message, MessageRole } from '@typeforge/types';

export function addMessage(
  db: Database.Database,
  params: { role: MessageRole; content: string; sessionId?: number | null }
): Message {
  const stmt = db.prepare(`
    INSERT INTO messages (role, content, session_id)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(params.role, params.content, params.sessionId ?? null);
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid) as Message;
  return row;
}

export function getMessages(
  db: Database.Database,
  params: { before?: number; limit?: number } = {}
): { messages: Message[]; hasMore: boolean } {
  const limit = params.limit ?? 50;

  let rows: Message[];
  if (params.before != null) {
    rows = db.prepare(`
      SELECT * FROM messages
      WHERE timestamp < ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(params.before, limit + 1) as Message[];
  } else {
    rows = db.prepare(`
      SELECT * FROM messages
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit + 1) as Message[];
  }

  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();

  return { messages: rows.reverse(), hasMore };
}

export function getRecentMessages(
  db: Database.Database,
  count: number = 20
): Message[] {
  const rows = db.prepare(`
    SELECT * FROM messages
    WHERE role IN ('user', 'assistant')
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(count) as Message[];

  return rows.reverse();
}
