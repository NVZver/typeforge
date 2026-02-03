import { Router } from 'express';
import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';
import type { SessionRequest } from '@typeforge/types';
import { addSession, getSession } from '../repositories/sessions.js';

const MAX_TEXT_LENGTH = 10000;
const MAX_KEY_STATS_ENTRIES = 128;
const MAX_BIGRAM_STATS_ENTRIES = 500;

function validateSessionRequest(body: unknown): { valid: true; data: SessionRequest } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be an object' };
  }

  const b = body as Record<string, unknown>;

  // Required numeric fields
  const numericFields = ['wpm', 'accuracy', 'errors', 'characters', 'duration_ms'] as const;
  for (const field of numericFields) {
    if (typeof b[field] !== 'number' || !Number.isFinite(b[field])) {
      return { valid: false, error: `${field} must be a finite number` };
    }
  }

  // Range validations
  if ((b.wpm as number) < 0) {
    return { valid: false, error: 'wpm must be non-negative' };
  }
  if ((b.accuracy as number) < 0 || (b.accuracy as number) > 1) {
    return { valid: false, error: 'accuracy must be between 0 and 1' };
  }
  if ((b.errors as number) < 0 || !Number.isInteger(b.errors)) {
    return { valid: false, error: 'errors must be a non-negative integer' };
  }
  if ((b.characters as number) < 0 || !Number.isInteger(b.characters)) {
    return { valid: false, error: 'characters must be a non-negative integer' };
  }
  if ((b.duration_ms as number) < 0 || !Number.isInteger(b.duration_ms)) {
    return { valid: false, error: 'duration_ms must be a non-negative integer' };
  }

  // Text field with length limit
  if (typeof b.text !== 'string' || b.text.length === 0) {
    return { valid: false, error: 'text must be a non-empty string' };
  }
  if (b.text.length > MAX_TEXT_LENGTH) {
    return { valid: false, error: `text must not exceed ${MAX_TEXT_LENGTH} characters` };
  }

  // keyStats validation with size limit
  if (!b.keyStats || typeof b.keyStats !== 'object' || Array.isArray(b.keyStats)) {
    return { valid: false, error: 'keyStats must be an object' };
  }
  const keyStatsEntries = Object.entries(b.keyStats as Record<string, unknown>);
  if (keyStatsEntries.length > MAX_KEY_STATS_ENTRIES) {
    return { valid: false, error: `keyStats must not exceed ${MAX_KEY_STATS_ENTRIES} entries` };
  }
  for (const [key, stat] of keyStatsEntries) {
    if (!stat || typeof stat !== 'object') {
      return { valid: false, error: `keyStats.${key} must be an object` };
    }
    const s = stat as Record<string, unknown>;
    if (typeof s.avgTime !== 'number' || !Number.isFinite(s.avgTime) || s.avgTime < 0) {
      return { valid: false, error: `keyStats.${key}.avgTime must be a non-negative number` };
    }
    if (typeof s.count !== 'number' || !Number.isInteger(s.count) || s.count < 0) {
      return { valid: false, error: `keyStats.${key}.count must be a non-negative integer` };
    }
  }

  // bigramStats validation with size limit
  if (!b.bigramStats || typeof b.bigramStats !== 'object' || Array.isArray(b.bigramStats)) {
    return { valid: false, error: 'bigramStats must be an object' };
  }
  const bigramStatsEntries = Object.entries(b.bigramStats as Record<string, unknown>);
  if (bigramStatsEntries.length > MAX_BIGRAM_STATS_ENTRIES) {
    return { valid: false, error: `bigramStats must not exceed ${MAX_BIGRAM_STATS_ENTRIES} entries` };
  }
  for (const [bigram, stat] of bigramStatsEntries) {
    if (!stat || typeof stat !== 'object') {
      return { valid: false, error: `bigramStats.${bigram} must be an object` };
    }
    const s = stat as Record<string, unknown>;
    if (typeof s.avgTime !== 'number' || !Number.isFinite(s.avgTime) || s.avgTime < 0) {
      return { valid: false, error: `bigramStats.${bigram}.avgTime must be a non-negative number` };
    }
    if (typeof s.count !== 'number' || !Number.isInteger(s.count) || s.count < 0) {
      return { valid: false, error: `bigramStats.${bigram}.count must be a non-negative integer` };
    }
  }

  return { valid: true, data: b as unknown as SessionRequest };
}

export function createSessionRouter(db: Database.Database): Router {
  const router = Router();

  router.post('/session', (req: Request, res: Response) => {
    const validation = validateSessionRequest(req.body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    try {
      const result = addSession(db, validation.data);
      res.status(201).json(result);
    } catch {
      res.status(500).json({ error: 'Failed to save session' });
    }
  });

  router.get('/session/:id', (req: Request, res: Response) => {
    const idParam = req.params.id;
    const id = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);
    if (Number.isNaN(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid session ID' });
      return;
    }

    try {
      const session = getSession(db, id);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      res.json(session);
    } catch {
      res.status(500).json({ error: 'Failed to retrieve session' });
    }
  });

  return router;
}
