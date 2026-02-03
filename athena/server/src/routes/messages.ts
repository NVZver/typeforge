import { Router } from 'express';
import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';
import { getMessages } from '../repositories/messages.js';

export function createMessagesRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/messages', (req: Request, res: Response) => {
    // Parse limit (default 20, max 100)
    let limit = 20;
    if (req.query.limit !== undefined) {
      const parsed = parseInt(req.query.limit as string, 10);
      if (Number.isNaN(parsed) || parsed < 1) {
        res.status(400).json({ error: 'limit must be a positive integer' });
        return;
      }
      limit = Math.min(parsed, 100);
    }

    // Parse before (optional timestamp)
    let before: number | undefined;
    if (req.query.before !== undefined) {
      const parsed = parseInt(req.query.before as string, 10);
      if (Number.isNaN(parsed) || parsed < 0) {
        res.status(400).json({ error: 'before must be a non-negative integer timestamp' });
        return;
      }
      before = parsed;
    }

    try {
      const result = getMessages(db, { before, limit });
      res.json(result);
    } catch {
      res.status(500).json({ error: 'Failed to retrieve messages' });
    }
  });

  return router;
}
