# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TypeForge is a dual-application monorepo:

1. **TypeForge (root)** - Next.js typing practice app with AI coaching
2. **Athena (`/athena`)** - New agent-controlled UI paradigm where the AI owns the interface

Athena is a PoC proving that a conversational agent can control what UI renders. The user interacts via chat; Athena decides what to show (typing exercise, results, messages) based on the conversation.

## Build & Development Commands

```bash
# Root (Next.js TypeForge)
npm run dev          # Next.js on :4201
npm run build
npm run lint

# Athena (from /athena)
npm run dev          # Runs client + server concurrently
npm run test         # Both workspaces
npm run build

# Athena Server (from /athena/server)
npm run dev          # tsx watch with auto-reload
npm run test         # Vitest
npm run test:watch

# Athena Client (from /athena/client)
npm run dev          # Vite dev server
npm run test
```

## Architecture

### TypeForge (Root)
- **`/src/app/`** - Next.js app router (pages: `/`, `/coach`, `/settings`, `/api/*`)
- **`/src/lib/`** - Core logic: `database.ts`, `ai-coach.ts`, `typing-engine.ts`
- **`/src/components/`** - React components
- **`/src/store/`** - Zustand stores

### Athena (`/athena`)
```
athena/
├── types/           # Shared TypeScript types (imported via @typeforge/types)
├── server/          # Express 5 backend
│   └── src/
│       ├── agent/   # LLM context assembly, system prompt, action parser
│       ├── llm/     # LMStudio client (OpenAI-compatible)
│       ├── repositories/  # DB CRUD (messages, sessions, stats)
│       └── routes/  # API endpoints (chat, session, messages, stats, health)
└── client/          # Svelte 5 frontend
    └── src/
        ├── stores/  # Svelte 5 runes state (.svelte.ts files)
        ├── components/
        └── lib/     # API client, SSE client
```

### Key Integration Points
- **SSE Streaming**: `/api/chat` streams LLM responses via Server-Sent Events
- **Action Markers**: LLM outputs `[ACTION:typing_session]text[/ACTION]` to trigger UI
- **Session Linkage**: Post-session flow saves metrics then sends `trigger: 'session_complete'` with `sessionId`

## Svelte 5 Conventions (Athena Client)

Use runes API, NOT legacy stores:
```typescript
// State
let value = $state(initial);
let computed = $derived(expression);
$effect(() => { /* side effects */ });

// Event handling - use callback props
export let onSend: (msg: string) => void;

// Native event syntax
<button onclick={handler}>
```

Do NOT use: `writable()`, `createEventDispatcher`, `on:event`

## Type Sharing

Types are in `/athena/types/` (plain directory, no package.json). Import via tsconfig paths:
```typescript
import type { Message } from '@typeforge/types';
```

## Database (Athena)

SQLite with tables: `sessions`, `messages`, `key_stats`, `bigram_stats`

Messages link to sessions via `session_id`. Stats tables reference sessions.

## LLM Integration

- Model: Qwen 2.5 7B via LMStudio (local, OpenAI-compatible)
- Streaming via async generator
- 30s timeout, 2 retries on empty response
- Context: system prompt + typing stats + last 10 messages

## Testing Approach

- **TDD for logic**: agent engine, DB repos, action parser
- **Manual/Playwright for visual**: UI components, styling
- Server tests use Supertest for API integration
