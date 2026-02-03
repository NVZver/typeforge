import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
import { createChatRouter } from './routes/chat.js';
import { createSessionRouter } from './routes/session.js';
import { createMessagesRouter } from './routes/messages.js';
import { createStatsRouter } from './routes/stats.js';
import { getDb } from './db.js';
import type Database from 'better-sqlite3';

export function createApp(db?: Database.Database) {
  const app = express();
  const database = db ?? getDb();

  app.use(cors());
  app.use(express.json());

  app.use('/api', healthRouter);
  app.use('/api', createChatRouter(database));
  app.use('/api', createSessionRouter(database));
  app.use('/api', createMessagesRouter(database));
  app.use('/api', createStatsRouter(database));

  return app;
}
