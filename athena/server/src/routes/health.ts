import { Router } from 'express';
import { checkHealth } from '../llm/lmstudio-client.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  const health = await checkHealth();
  res.json(health);
});
