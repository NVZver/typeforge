import { Router } from 'express';
import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';
import type { StatsResponse } from '@typeforge/types';
import {
  getTotalSessions,
  getBestWpm,
  getRecentAverages,
  getWeakestKeys,
  getWeakestBigrams,
} from '../repositories/stats.js';

export function createStatsRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/stats', (_req: Request, res: Response) => {
    try {
      const totalSessions = getTotalSessions(db);
      const bestWpm = getBestWpm(db);
      const { avgWpm, avgAccuracy } = getRecentAverages(db);
      const weakestKeys = getWeakestKeys(db);
      const weakestBigrams = getWeakestBigrams(db);

      const response: StatsResponse = {
        totalSessions,
        bestWpm,
        recentAvgWpm: avgWpm,
        recentAvgAccuracy: avgAccuracy,
        weakestKeys,
        weakestBigrams,
      };

      res.json(response);
    } catch {
      res.status(500).json({ error: 'Failed to retrieve stats' });
    }
  });

  return router;
}
