import { Router } from 'express';
import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';
import type { ChatRequest } from '@typeforge/types';
import { addMessage } from '../repositories/messages.js';
import { assembleContext } from '../agent/context.js';
import { extractAction, stripActionMarkers } from '../agent/action-parser.js';
import { streamChatCompletion } from '../llm/lmstudio-client.js';

function sendSSE(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function createChatRouter(db: Database.Database): Router {
  const router = Router();

  router.post('/chat', async (req: Request, res: Response) => {
    const body = req.body as ChatRequest;
    const { trigger, sessionData, sessionId } = body;
    const userMessage = typeof body.message === 'string' ? body.message : undefined;

    // Validate trigger if provided
    if (trigger && trigger !== 'greeting' && trigger !== 'session_complete') {
      res.status(400).json({ error: 'Invalid trigger' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      // Save user message if provided
      if (userMessage) {
        addMessage(db, { role: 'user', content: userMessage });
      }

      // Assemble context
      const contextMessages = assembleContext(db, trigger ?? null, sessionData);

      // Stream tokens from LMStudio
      let buffer = '';
      for await (const token of streamChatCompletion(contextMessages)) {
        sendSSE(res, 'text', { token });
        buffer += token;
      }

      // Process completed response
      const action = extractAction(buffer);
      const strippedText = stripActionMarkers(buffer);

      // Save assistant message
      addMessage(db, {
        role: 'assistant',
        content: strippedText,
        sessionId: sessionId ?? null,
      });

      // Send final event
      if (action) {
        sendSSE(res, 'action', action);
      } else {
        sendSSE(res, 'done', {});
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';

      if (errMsg.includes('timed out')) {
        sendSSE(res, 'error', { message: 'Response took too long. Please try again.', code: 'timeout' });
      } else if (errMsg.includes('ECONNREFUSED') || errMsg.includes('fetch failed')) {
        sendSSE(res, 'error', { message: 'Athena is offline. Make sure LMStudio is running.', code: 'connection_error' });
      } else if (errMsg.includes('Empty response')) {
        sendSSE(res, 'error', { message: 'Got an empty response. Please try again.', code: 'empty_response' });
      } else {
        sendSSE(res, 'error', { message: 'Something went wrong.', code: 'unknown' });
      }
    }

    res.end();
  });

  return router;
}
