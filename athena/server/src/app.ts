import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
import { createChatRouter } from './routes/chat.js';
import { getDb } from './db.js';
import type Database from 'better-sqlite3';

export function createApp(db?: Database.Database) {
  const app = express();
  const database = db ?? getDb();

  app.use(cors());
  app.use(express.json());

  app.use('/api', healthRouter);
  app.use('/api', createChatRouter(database));

  return app;
}
