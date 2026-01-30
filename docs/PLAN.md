# Athena PoC — Implementation Plan

> **Version:** 1.3 (parallel safety fixes)
> **Last Updated:** 2026-01-30

---

## Roles

| Role | Responsibility |
|------|---------------|
| **Architect** | Defines project structure, tooling, build config, DB schema, API contracts. Owns `Epic 1`. |
| **Backend Engineer** | Implements Express server, SQLite layer, agent engine, SSE streaming, all API endpoints. Owns `Epic 2` and `Epic 3`. |
| **Frontend Engineer** | Implements Svelte 5 app, chat UI, typing view, heatmap, state management. Owns `Epic 4` and `Epic 5`. |
| **Integration Engineer** | Wires end-to-end flows, polishes transitions, error states, loading indicators. Owns `Epic 6`. |
| **QA/TDD Lead** | TDD for logic modules (typing engine, action parser, DB repos, context assembly). Manual/Playwright verification for visual work. Validates each deliverable against PRD success criteria. |

Epics 1–2 and the validation gate run sequentially. After the gate passes, two parallel agents execute the backend (Epic 3) and frontend (Epics 4–5) tracks simultaneously. Epic 6 is sequential after both tracks complete.

---

## Stack & Tooling

| Layer | Technology |
|-------|-----------|
| Frontend | Svelte 5 (Vite) — **runes API** (`$state`, `$derived`, `$effect`), callback props, native event syntax |
| Backend | Node.js + Express 5 |
| Database | SQLite via better-sqlite3 |
| LLM | Qwen 2.5 7B via LMStudio (OpenAI-compatible API) |
| Streaming | Server-Sent Events (SSE) |
| Styling | Tailwind CSS v4 (Vite plugin, not PostCSS) |
| Testing | Vitest (unit/integration), Supertest (API), Playwright (E2E visual) |
| Types | Shared `types/` directory with plain `.ts` files — imported via tsconfig `paths` alias, no separate workspace package |
| Docs | JSDoc on all exported functions, types, and modules |

---

## Review Findings — Addressed

| # | Finding | Resolution |
|---|---------|------------|
| 1 | Svelte 5 runes vs stores mismatch | State uses `$state` in `.svelte.ts` files. No `writable()` stores. Events use callback props (`onSend`), not `createEventDispatcher`. Native event syntax (`onclick`, `onsubmit`). |
| 2 | Greeting context missing time-of-day, days-since-last-session | Added to Task 2.2.3 — greeting context builder queries last session timestamp and includes `daysSinceLastSession` and `timeOfDay`. |
| 3 | `session_id` linkage gap in post-session flow | Added to Task 2.4.4 — when `trigger === 'session_complete'`, the chat route receives `sessionId` in the request body and sets it on the saved assistant message. Client sends `sessionId` alongside `sessionData`. |
| 4 | Action marker flash during streaming | Acknowledged as PRD Known Limitation #2. Plan does not buffer or suppress markers mid-stream. Client strips markers from displayed text when `action` event arrives. Acceptable for PoC. |
| 5 | Express 5 compatibility | Express 5 is the target. Route handlers use Express 5 types. No `app.del()` usage. |
| 6 | Message loading on app open | Added to Task 4.1 — `onMount` calls `GET /api/messages` to load existing history before requesting greeting. |
| 7 | Missing `GET /api/session/:id` | Added as Task 3.1 subtask 4. Returns session with key/bigram stats for rich message rendering. |
| 8 | TDD impractical for visual tasks | TDD reserved for logic modules only. Visual work uses manual verification and Playwright screenshots in Epic 6. |
| 9 | `eventsource-parser` unnecessary | Removed from dependencies. SSE parsing uses `fetch()` + `ReadableStream` with manual line parsing. |
| 10 | Build order delays frontend validation | Added Task 2.5 — minimal chat UI spike immediately after agent engine, before Epic 3. Validates SSE streaming end-to-end. |
| 11 | Types workspace resolution | Types is a plain directory (no `package.json` workspace). Both client and server use tsconfig `paths`: `"@typeforge/types": ["../types/index.ts"]`. Vite uses `resolve.alias`. |
| 12 | No concurrency protection | Client disables input while `isLoading` is true (covers UI side). Server-side: out of scope per PRD Known Limitation #5, documented as accepted risk. |

### Parallel Safety Findings — Addressed (v1.3)

| # | Finding | Resolution |
|---|---------|------------|
| 1 | Task 2.5 writes to `client/`, conflicts with Agent B | Moved Task 2.5 to a sequential gate phase **between Epic 1 and the parallel split**. Runs before either agent starts. Agent B's full Epic 4 work replaces the spike code. |
| 2 | `npm install` lockfile conflicts | Added Task 1.1 subtask 7: install **all** dependencies for both workspaces during Epic 1. Agents must NOT run `npm install` during parallel execution. |
| 3 | `sessionId` missing from `ChatRequest` type in Epic 1 | Added explicit note to Task 1.3.1: `ChatRequest` must include optional `sessionId?: number` field for session-complete linkage. |
| 4 | SSE wire format not in type contract | Added explicit note to Task 1.3.2: `types/sse.ts` must include JSDoc specifying the SSE wire format (`event: <type>\ndata: <json>\n\n`). |
| 5 | Agent B may start SSE work before gate passes | Added sync constraint: Agent B must NOT begin Task 4.2 (chat components + SSE client) until the validation gate passes. Tasks 5.1, 4.1, 4.4 can proceed freely. |
| 6 | Root `npm test` breaks during parallel | Agents run workspace-scoped tests only (`npm run test:server` / `npm run test:client`). Root `npm test` reserved for Epic 6 verification. |

---

## Epic 1: Project Foundation & Infrastructure — `Sequential`

**Goal:** Scaffolded project with build tooling, test harness, and DB schema ready.

### Task 1.1: Scaffold Project Structure
**Output:** Working `npm run dev` for both client and server with hot reload.

| # | Subtask | TDD | Output |
|---|---------|-----|--------|
| 1 | Create project structure: `client/` (Vite + Svelte 5), `server/` (Express + TS), plain `types/` directory (no workspace) | N/A (config) | `package.json` root with workspaces for client/server only, both apps boot |
| 2 | Configure tsconfig `paths` in both client and server: `"@typeforge/types": ["../types/index.ts"]`. Configure Vite `resolve.alias` for the same. | N/A (config) | Types importable from both packages without compilation step |
| 3 | Configure Vitest for server and client with coverage thresholds | Test: Vitest runs and reports 0 tests | `vitest.config.ts` in both packages |
| 4 | Configure Tailwind CSS v4 via `@tailwindcss/vite` plugin (NOT PostCSS) | Test: Tailwind utility class renders correctly | `app.css` with `@import 'tailwindcss'` |
| 5 | Add Supertest for API integration tests | Test: Dummy GET `/api/health` returns 200 | `server/tests/setup.ts` with app factory |
| 6 | Configure TypeScript strict mode in both packages | N/A (config) | `tsconfig.json` per package |
| 7 | Install **all** dependencies for both workspaces (client and server) from root. **Constraint:** Agents MUST NOT run `npm install` during parallel execution — all deps must be present before the split. | N/A (config) | `node_modules/` populated, lockfile committed |

### Task 1.2: Database Layer
**Output:** Fully tested SQLite module with all tables from PRD Section 5.5.

| # | Subtask | TDD | Output |
|---|---------|-----|--------|
| 1 | Define TypeScript interfaces for all DB entities (`Message`, `Session`, `KeyStat`, `BigramStat`) | Test: Types compile, fixtures pass validation | `types/database.ts` |
| 2 | Implement `db.ts` — schema creation with all 4 tables, indexes, WAL mode | Test: DB initializes, tables exist, schema matches spec | `server/src/db.ts` |
| 3 | Implement message CRUD (`addMessage`, `getMessages` with pagination, `getRecentMessages`) | Test: Insert/query/paginate messages correctly | `server/src/repositories/messages.ts` |
| 4 | Implement session CRUD (`addSession` with key/bigram stats, `getSession` by ID with stats) | Test: Save session → query stats → values match | `server/src/repositories/sessions.ts` |
| 5 | Implement stats queries (`getWeakestKeys`, `getWeakestBigrams`, `getRecentAverages`) | Test: Aggregate queries return correct top-N results | `server/src/repositories/stats.ts` |

### Task 1.3: Shared Type Definitions & API Contracts
**Output:** TypeScript types for all API request/response shapes, SSE events.

| # | Subtask | TDD | Output |
|---|---------|-----|--------|
| 1 | Define API request/response types for all endpoints (PRD 5.6) including `GET /api/session/:id` response type. **Must include** `sessionId?: number` in `ChatRequest` for session-complete linkage (used by post-session coaching flow). | Test: Types compile, sample payloads match | `types/api.ts` |
| 2 | Define SSE event types (`TextEvent`, `ActionEvent`, `DoneEvent`, `ErrorEvent`). **Must include** JSDoc specifying the SSE wire format: `event: <type>\ndata: <json>\n\n`. This serves as the contract both agents code against. | Test: Event discriminated union works with type narrowing | `types/sse.ts` |
| 3 | Define app state types (`CurrentView`, `ConnectionStatus`, `AppState`) | Test: State transitions compile correctly | `types/state.ts` |

---

## Epic 2: Agent Engine & LLM Integration — `Sequential (before parallel split)`

**Goal:** Express server can receive a chat request, call LMStudio, stream tokens via SSE, and extract actions. Runs sequentially before the parallel split so the validation gate can write to `client/` without conflicting with Agent B.

### Task 2.1: LMStudio Client
**Output:** Tested LLM client that streams completions from LMStudio.

| # | Subtask | TDD | Output |
|---|---------|-----|--------|
| 1 | Implement `lmstudio-client.ts` — connection test (`GET /v1/models`) | Test: Mock server → client reports connected/error correctly | `server/src/llm/lmstudio-client.ts` |
| 2 | Implement streaming chat completion (`POST /v1/chat/completions` with `stream: true`) | Test: Mock SSE stream → client yields tokens in order | Streaming generator function |
| 3 | Implement retry logic (2 retries on empty response) and timeout (30s abort) | Test: Empty response → retries → succeeds on 2nd attempt; timeout → aborts | Retry wrapper |
| 4 | Implement health check combining connection + model loaded | Test: Models loaded → `connected`; no models → `error` | `checkHealth()` function |

### Task 2.2: Context Assembly
**Output:** Function that builds the full LLM message array from system prompt + stats + history.

| # | Subtask | TDD | Output |
|---|---------|-----|--------|
| 1 | Write system prompt as a template (personality, action format, typing instructions) | Test: Template renders with sample data, stays under 500 tokens | `server/src/agent/system-prompt.ts` |
| 2 | Implement `assembleContext()` — merges system prompt + typing stats + last 10 messages | Test: Output is valid OpenAI messages array, ≤ 2500 tokens budget | `server/src/agent/context.ts` |
| 3 | Implement greeting context variant: queries last session timestamp, computes `daysSinceLastSession` and `timeOfDay` (morning/afternoon/evening). Zero sessions → `firstLaunch: true`. | Test: Zero sessions → `firstLaunch: true`; existing sessions → includes `daysSinceLastSession` and `timeOfDay` | Greeting context builder |
| 4 | Implement session-complete context variant (includes session metrics payload) | Test: Session data injected into user message correctly | Session-complete context builder |

### Task 2.3: Action Extraction
**Output:** Parser that extracts `[ACTION:typing_session]...[/ACTION]` from LLM output.

| # | Subtask | TDD | Output |
|---|---------|-----|--------|
| 1 | Implement `extractAction()` — regex parser for action markers | Test: Valid markers → extracted; no markers → null; malformed → null | `server/src/agent/action-parser.ts` |
| 2 | Implement `stripActionMarkers()` — removes markers from display text | Test: Text with markers → clean text; text without → unchanged | Same file |
| 3 | Implement action validation (type must be `start_typing_session`, text must be non-empty) | Test: Valid action → passes; empty text → rejected; unknown type → rejected | Same file |

### Task 2.4: SSE Streaming Endpoint (`POST /api/chat`)
**Output:** Full chat endpoint that streams tokens and emits action events.

| # | Subtask | TDD | Output |
|---|---------|-----|--------|
| 1 | Implement SSE response setup (headers, event formatting, keep-alive) | Test: Response has correct SSE headers, events are properly formatted | `server/src/routes/chat.ts` |
| 2 | Implement token forwarding (LLM stream → SSE `text` events) | Test (integration): POST `/api/chat` → receives streamed text events | Token forwarding pipeline |
| 3 | Implement post-stream processing (buffer full response, extract action, emit `action` or `done`) | Test: Response with markers → `action` event emitted; without → `done` | Post-stream handler |
| 4 | Implement message persistence: save user message + assistant response to DB (strip markers). When `trigger === 'session_complete'`, accept `sessionId` in request body and set `session_id` on the saved assistant message for rich rendering linkage. | Test: After chat → both messages in DB, no markers in stored content. Session-complete → assistant message has correct `session_id`. | DB save step |
| 5 | Implement error handling (LMStudio offline, timeout, empty response, malformed action) | Test: Each error scenario → correct `error` SSE event with proper message | Error handlers per PRD 5.3 |

---

## Validation Gate: Minimal Chat UI Spike — `Sequential (before parallel split)`

**Goal:** Prove SSE streaming works end-to-end with the agent engine before committing to parallel execution. Runs after Epic 2 Tasks 2.1–2.4, before agents split.

**Output:** Bare-minimum Svelte chat page that proves SSE streaming works end-to-end with the agent engine. This spike code lives in `client/` temporarily — Agent B's Epic 4 work replaces it entirely.

| # | Subtask | TDD | Output |
|---|---------|-----|--------|
| 1 | Implement minimal `App.svelte` with text input and message display area | N/A (spike) | Basic chat works visually |
| 2 | Implement `fetch()` + `ReadableStream` SSE parsing for POST `/api/chat` | N/A (spike) | Tokens stream into UI in real-time |
| 3 | Validate: send "let's practice" → LLM responds with action markers → action event received | Manual test | Core hypothesis validated or flagged |

**Gate:** If the 7B model can't reliably trigger actions after this task, stop and adjust (swap models, change protocol, add structured output) before building more. If it passes, both agents start in parallel.

---

## Epic 3: REST API Endpoints — `Agent A (Backend)`

**Goal:** All remaining API endpoints implemented and tested.

### Task 3.1: Session Endpoints
**Output:** Save typing session, retrieve session with stats.

| # | Subtask | TDD | Output |
|---|---------|-----|--------|
| 1 | `POST /api/session` — request validation (all required fields, types, ranges) | Test: Valid payload → 200; missing fields → 400; invalid types → 400 | `server/src/routes/session.ts` |
| 2 | Implement session save with transactional key/bigram stat inserts | Test: Save → session + all stats in DB; partial failure → rollback | Transaction logic |
| 3 | Return `{ id: number }` response | Test: Response matches schema, ID is valid auto-increment | Response serialization |
| 4 | `GET /api/session/:id` — return session with key stats and bigram stats | Test: Existing ID → full session data with stats; missing ID → 404 | Same file |

### Task 3.2: Messages Endpoint (`GET /api/messages`)
**Output:** Paginated message history with cursor-based pagination.

| # | Subtask | TDD | Output |
|---|---------|-----|--------|
| 1 | Implement query params parsing (`before` timestamp, `limit` with default 20) | Test: Default limit → 20; custom limit → respected; invalid → 400 | `server/src/routes/messages.ts` |
| 2 | Implement cursor-based pagination (messages before timestamp, ordered DESC, returned in chronological order) | Test: 50 messages → first page 20, second page 20, third page 10, `hasMore` correct | Pagination query |
| 3 | Include `session_id` in response for rich message rendering | Test: Messages with sessions include `session_id`; others have `null` | Response shape |

### Task 3.3: Stats Endpoint (`GET /api/stats`)
**Output:** Aggregated typing statistics per PRD Section 5.6.

| # | Subtask | TDD | Output |
|---|---------|-----|--------|
| 1 | Implement aggregation queries (recent 10 session averages, best WPM, total sessions) | Test: Known data → exact expected averages | `server/src/routes/stats.ts` |
| 2 | Implement weakest keys/bigrams (top 5 by avg time across all sessions) | Test: Seeded data → correct top 5 ordering | Aggregation queries |

### Task 3.4: Health Check Endpoint (`GET /api/health`)
**Output:** LMStudio connectivity check.

| # | Subtask | TDD | Output |
|---|---------|-----|--------|
| 1 | Implement health check (ping LMStudio, check model loaded) | Test: LMStudio up → `connected` + model name; down → `error` + message | `server/src/routes/health.ts` |
| 2 | Return response matching PRD schema | Test: Response matches `{ status, model, error }` shape exactly | Response serialization |

---

## Epic 4: Svelte Frontend — Chat View — `Agent B (Frontend)`

**Goal:** Working chat interface with SSE streaming, message history, and rich content rendering.

**Svelte 5 conventions used throughout:**
- State: `$state()` in `.svelte.ts` files, not `writable()` stores
- Derived values: `$derived()`, not `$:` reactive statements
- Side effects: `$effect()`, not `$:` blocks
- Events: callback props (`onSend`, `onClick`), not `createEventDispatcher`
- DOM events: `onclick`, `onsubmit`, `onkeydown` (native syntax), not `on:click`

### Task 4.1: App Shell & State Management
**Output:** Svelte app with view routing, global state, and dark cyberpunk theme.

| # | Subtask | TDD | Output |
|---|---------|-----|--------|
| 1 | Implement shared state using `$state()` rune in `app.svelte.ts`: `currentView`, `messages`, `connectionStatus`, `isLoading`, `typingText` | Test: State mutations work correctly (chat → typing → chat) | `client/src/stores/app.svelte.ts` |
| 2 | Implement view switching logic (chat ↔ typing fullscreen takeover) | Test: Action received → view switches; escape → returns to chat | `client/src/App.svelte` |
| 3 | Implement initial message loading: `onMount` calls `GET /api/messages` to load existing history, then requests greeting | Test: On mount → existing messages loaded before greeting | Init logic in `App.svelte` |
| 4 | Apply dark cyberpunk theme (CSS variables for all PRD 6.1 colors, fonts) | Manual verification | `client/src/app.css` |
| 5 | Implement status bar (connection indicator, health check polling every 30s) | Test: Connected → green dot; error → disabled input + banner | `client/src/components/StatusBar.svelte` |

### Task 4.2: Chat Message Components
**Output:** Message list with streaming support and scroll-to-load.

> **Sync constraint:** Agent B must NOT begin this task until the validation gate passes. Tasks 5.1, 4.1, and 4.4 can proceed freely before the gate.

| # | Subtask | TDD | Output |
|---|---------|-----|--------|
| 1 | Implement `ChatMessage.svelte` (user vs assistant styling, markdown rendering). Uses callback props, not event dispatchers. | Manual verification | `client/src/components/ChatMessage.svelte` |
| 2 | Implement `ChatInput.svelte` (input field, send button, disabled states). Uses `onSend` callback prop and `onsubmit`/`onkeydown` native events. | Test: Send → callback called; disabled when loading/offline; Enter to submit | `client/src/components/ChatInput.svelte` |
| 3 | Implement SSE client using `fetch()` + `ReadableStream` manual line parsing (no `eventsource-parser` dependency) | Test: Mock SSE stream → tokens arrive in order; action event parsed correctly | `client/src/lib/sse-client.ts` |
| 4 | Implement streaming message display (tokens append in real-time). On `action` event, strip `[ACTION:...]...[/ACTION]` from displayed text (acknowledged: markers flash briefly per PRD Known Limitation #2). | Test: Streamed tokens → message grows; action event → markers stripped from display | Streaming renderer |
| 5 | Implement scroll-to-load (IntersectionObserver triggers `/api/messages` pagination) | Test: Scroll to top → older messages loaded; `hasMore: false` → stops | Pagination loader |

### Task 4.3: Rich Session Messages
**Output:** Metrics card + keyboard heatmap rendered inline in chat for session results.

| # | Subtask | TDD | Output |
|---|---------|-----|--------|
| 1 | Implement `MetricsCard.svelte` (WPM, accuracy, errors, duration display) | Manual verification | `client/src/components/MetricsCard.svelte` |
| 2 | Implement `KeyboardHeatmap.svelte` (Workman layout, CSS grid, 5-level color scale per PRD 6.4) | Manual verification: key colors, untyped keys neutral, top 3 slowest get glow border | `client/src/components/KeyboardHeatmap.svelte` |
| 3 | Implement rich message detection: messages with `session_id` → `GET /api/session/:id` → render MetricsCard + KeyboardHeatmap above text | Test: Message with session_id → fetch triggered → components rendered; without → plain text | Rich message renderer |

### Task 4.4: Loading & Error States
**Output:** All async states have proper UI feedback per PRD 6.5.

| # | Subtask | TDD | Output |
|---|---------|-----|--------|
| 1 | Implement pulsing dots loading indicator (waiting for first LLM token) | Manual verification | `client/src/components/LoadingDots.svelte` |
| 2 | Implement offline banner ("Athena is offline — LMStudio is not running.") | Test: connectionStatus error → banner shown, input disabled | Banner component |
| 3 | Implement error messages in chat (timeout, malformed response) | Test: Error SSE event → error message rendered in chat | Error message handler |

---

## Epic 5: Svelte Frontend — Typing View — `Agent B (Frontend)`

**Goal:** Fullscreen typing practice with real-time feedback, direct DOM manipulation, and metrics capture.

> **Note:** Task 5.1 (typing engine) is Agent B's **first task** — it runs before Epic 4. Tasks 5.2–5.3 run after Epic 4.

### Task 5.1: Typing Engine (Core Logic)
**Output:** Framework-agnostic typing engine that processes keystrokes and computes metrics.

| # | Subtask | TDD | Output |
|---|---------|-----|--------|
| 1 | Implement `TypingEngine` class — initialize with target text, expose `processKey()` | Test: Process 'h','e','l','l','o' against "hello" → all correct, position advances | `client/src/lib/typing-engine.ts` |
| 2 | Implement per-key timing tracking (timestamps per keystroke, average computation) | Test: Known timing sequence → correct avg_time_ms per key | Timing tracker |
| 3 | Implement bigram timing tracking (consecutive key pair timings) | Test: Known sequence → correct bigram averages | Bigram tracker |
| 4 | Implement metrics computation (WPM, accuracy, errors, duration) per PRD formulas | Test: Known input → WPM matches `(chars/5)/minutes`, accuracy matches `(correct/total)*100` | Metrics calculator |
| 5 | Implement backspace handling (delete last char, Ctrl+Backspace delete word) | Test: Type "hello", backspace 2 → position at 'l'; Ctrl+BS → position at start of word | Deletion handlers |

### Task 5.2: Typing View Component
**Output:** Fullscreen typing UI with character-by-character feedback.

| # | Subtask | TDD | Output |
|---|---------|-----|--------|
| 1 | Implement `TypingView.svelte` — fullscreen overlay, text display with character spans | Manual verification | `client/src/components/TypingView.svelte` |
| 2 | Implement direct DOM character updates (correct=cyan, incorrect=magenta, current=white glow, upcoming=dimmed) | Manual verification: DOM classes update without Svelte reactivity overhead | DOM manipulation logic |
| 3 | Implement `keydown` window listener (capture keystrokes, route to engine, update DOM) | Test: Keydown events → engine processes → DOM updates | Event handler |
| 4 | Implement session completion (last char typed → compute final metrics → transition to chat) | Test: Complete all chars → metrics computed → view switches | Completion handler |
| 5 | Implement Escape cancellation (discard all data, return to chat silently) | Test: Escape mid-session → view switches to chat, no API calls made | Cancel handler |

### Task 5.3: Post-Session Flow
**Output:** Session save + coaching feedback request wired together, with `session_id` linkage.

| # | Subtask | TDD | Output |
|---|---------|-----|--------|
| 1 | Implement `POST /api/session` call with full metrics payload. Store returned `sessionId`. | Test: Session complete → API called with correct payload → ID returned | API client |
| 2 | Implement `POST /api/chat` with `trigger: "session_complete"`, `sessionData` (metrics), AND `sessionId` (from step 1) so the server links the coaching message to the session for rich rendering. | Test: After save → chat request includes sessionId → coaching response streamed → response message in DB has `session_id` set | Coaching trigger |
| 3 | Implement fallback (coaching request fails → session saved, user can retry manually via "how did I do?") | Test: Save succeeds, chat fails → no crash, session persisted | Error recovery |

---

## Epic 6: Integration, Polish & Verification — `Sequential (after both agents complete)`

**Goal:** End-to-end flows work, all PRD success criteria met, cyberpunk styling complete.

### Task 6.1: End-to-End Flow Integration
**Output:** Complete user journeys work from greeting to post-session coaching.

| # | Subtask | TDD | Output |
|---|---------|-----|--------|
| 1 | Implement greeting flow (app open → load existing messages → greeting trigger → Athena greeting) | Test (E2E): App opens → existing history + greeting message appear | Greeting integration |
| 2 | Implement practice flow (user says "let's practice" → action → typing → save → coaching with `session_id` linkage → metrics card + heatmap render) | Test (E2E): Full loop completes, session in DB, coaching references metrics, rich rendering works | Practice loop |
| 3 | Implement follow-up flows ("again", "what are my weak keys?", free chat) | Test (E2E): Each follow-up type handled correctly by LLM | Conversational continuity |

### Task 6.2: Cyberpunk Visual Polish
**Output:** UI matches PRD Section 6.1 design language.

| # | Subtask | Verification | Output |
|---|---------|--------------|--------|
| 1 | Apply all color tokens (background, accents, text, error, success) per PRD hex values | Playwright screenshot | Theme CSS |
| 2 | Apply typography (JetBrains Mono for agent/typing, Inter for UI labels) | Playwright screenshot | Font loading |
| 3 | Apply effects (glow on focus, 200-300ms transitions, pulsing animations) | Manual verification | Animation CSS |
| 4 | Polish chat layout (message bubbles, scroll behavior, input area) | Playwright screenshot vs PRD 6.2 wireframe | Chat CSS |

### Task 6.3: Error Resilience & Edge Cases
**Output:** All error scenarios from PRD handled gracefully.

| # | Subtask | TDD | Output |
|---|---------|-----|--------|
| 1 | LMStudio offline → clear error message within 2s, no crash | Test: LMStudio unreachable → banner appears, input disabled, auto-retry 30s | Offline handling |
| 2 | LLM timeout (>30s) → abort, show error in chat | Test: Slow mock → timeout → error message | Timeout handling |
| 3 | Malformed action markers → treat as plain text, no action | Test: Broken markers → message displayed as text, no typing session | Fallback parsing |
| 4 | Empty LLM response → retry 2x, then error | Test: Empty response mock → 2 retries → error event | Retry logic |

### Task 6.4: PRD Success Criteria Verification
**Output:** All 8 success criteria from PRD Section 11 validated.

| # | Criterion | Validation Method | Output |
|---|-----------|-------------------|--------|
| 1 | Chat works — message → streamed response < 15s | Integration test with LMStudio running | Pass/fail |
| 2 | Typing session triggers ≥ 8/10 times | Manual test with 10 requests (LLM-dependent, not automatable) | Pass/fail |
| 3 | Keystroke-to-visual < 16ms | Performance benchmark: timestamp before processKey → timestamp after DOM update | Pass/fail |
| 4 | WPM/accuracy match manual calculation within 1% | Unit test with known inputs and deterministic timing | Pass/fail |
| 5 | Post-session coaching references actual metrics | Manual test: verify coaching text contains WPM/accuracy numbers from session | Pass/fail |
| 6 | Data persistence — survives refresh and restart | Integration test: save data → restart server → data still present | Pass/fail |
| 7 | Error resilience — LMStudio offline → error within 2s | Integration test with mocked unreachable endpoint | Pass/fail |
| 8 | UI transitions — chat ↔ typing < 300ms | Playwright timing measurement | Pass/fail |

---

## Execution Model: Parallel Tracks

After Epic 1 completes, Epic 2 + validation gate run sequentially (they write to both `server/` and `client/`). Only after the gate passes do two independent agent tracks run **in parallel**. They converge at Epic 6.

```
Epic 1 (Sequential — single agent)
  │
Epic 2 (Sequential — single agent)
  Tasks 2.1–2.4 (LLM client, context, parser, SSE endpoint)
  │
Validation Gate (Sequential — single agent)
  Minimal chat spike in client/ — proves SSE + action markers work
  │
  ├─ GATE: Does 7B model reliably trigger actions?
  │  FAIL → stop, adjust protocol before proceeding
  │  PASS ↓
  │
  ├─── Agent A: Backend ──────────────────────────────────────┐
  │    Epic 3 (REST APIs)                                      │
  │      Tasks 3.1–3.4 (session, messages, stats, health)      │
  │                                                             │
  ├─── Agent B: Frontend ─────────────────────────────────────┐
  │    Task 5.1 (Typing Engine — pure logic, zero server deps) │
  │    Epic 4 (Chat View)                                      │
  │      Task 4.1 (app shell + state)                          │
  │      Task 4.4 (loading/error states)                       │
  │      ── wait for gate (already passed) ──                  │
  │      Task 4.2 (chat components + SSE client)               │
  │      Task 4.3 (rich session messages)                      │
  │    Tasks 5.2–5.3 (Typing View UI, post-session flow)       │
  │                                                             │
  └─── Both complete ──→ Epic 6 (Sequential — single agent) ──┘
                          Tasks 6.1–6.4 (integration, polish, verification)
```

### Why This Works

| Concern | Resolution |
|---------|------------|
| **No file conflicts** | Agent A writes only to `server/`. Agent B writes only to `client/`. No overlap. The validation gate (which touches `client/`) runs sequentially **before** Agent B starts. |
| **No lockfile conflicts** | All dependencies are installed in Epic 1 Task 1.1.7. Agents MUST NOT run `npm install` during parallel execution. |
| **Shared types are read-only** | `types/` is finalized in Epic 1. Neither agent modifies it. If a type change is needed, Agent A owns it and Agent B pauses. |
| **Agent B doesn't need a running server** | Task 5.1 is pure logic. Tasks 4.1, 4.4 build shells against type contracts. Task 4.2+ needs the SSE wire format contract (defined in `types/sse.ts` JSDoc) but not a live server. |
| **Validation gate is sequential** | The gate runs before the parallel split, not inside Agent A's track. It writes spike code to `client/` which Agent B's Epic 4 replaces entirely. |
| **Agent B sync point** | Agent B must not begin Task 4.2 until the gate passes. Tasks 5.1, 4.1, and 4.4 can proceed freely. |
| **Tests during parallel** | Each agent runs workspace-scoped tests only (`npm run test:server` / `npm run test:client`). Root `npm test` is reserved for Epic 6 verification. |
| **Epic 6 needs both** | Integration wiring requires both server and client complete. Runs sequentially after both tracks finish. |

### Agent Assignments

**Sequential (single agent — before parallel split):**
- Epic 1: Tasks 1.1, 1.2, 1.3
- Epic 2: Tasks 2.1, 2.2, 2.3, 2.4
- Validation Gate (minimal chat spike)

**Agent A (Backend)** — writes to `server/` only, MUST NOT run `npm install`:
- Epic 3: Tasks 3.1, 3.2, 3.3, 3.4

**Agent B (Frontend)** — writes to `client/` only, MUST NOT run `npm install`:
- Epic 5: Task 5.1 (typing engine — start here, no server dependency)
- Epic 4: Tasks 4.1, 4.4 (can start immediately)
- Epic 4: Tasks 4.2, 4.3 (must wait for validation gate to pass)
- Epic 5: Tasks 5.2, 5.3

**Sequential (single agent — after both agents complete):**
- Epic 6: Tasks 6.1, 6.2, 6.3, 6.4

### Ordering Within Each Track

**Sequential phase:**
```
1.1–1.3 (foundation)
→ 2.1 (LLM client) → 2.2 (context) → 2.3 (action parser) → 2.4 (chat SSE endpoint)
→ Validation Gate (minimal chat spike — writes to client/)
→ GATE PASS → start both agents in parallel
```

**Agent A sequence (parallel):**
```
3.4 (health) → 3.2 (messages) → 3.3 (stats) → 3.1 (session + GET by ID)
```

**Agent B sequence (parallel):**
```
5.1 (typing engine — pure logic, first)
→ 4.1 (app shell + state) → 4.4 (loading/error states)
── gate already passed ──
→ 4.2 (chat components + SSE client) → 4.3 (rich session messages)
→ 5.2 (typing view UI) → 5.3 (post-session flow)
```

Agent B starts with Task 5.1 (typing engine) because it has zero dependencies — not even on Svelte. Tasks 4.1 and 4.4 also have no SSE dependency, giving additional work before any gate synchronization is needed.

---

## File Structure (Target)

```
typeforge/
├── client/
│   ├── src/
│   │   ├── App.svelte
│   │   ├── app.css
│   │   ├── main.ts
│   │   ├── components/
│   │   │   ├── ChatMessage.svelte
│   │   │   ├── ChatInput.svelte
│   │   │   ├── StatusBar.svelte
│   │   │   ├── MetricsCard.svelte
│   │   │   ├── KeyboardHeatmap.svelte
│   │   │   ├── TypingView.svelte
│   │   │   └── LoadingDots.svelte
│   │   ├── stores/
│   │   │   └── app.svelte.ts          ← .svelte.ts for runes
│   │   └── lib/
│   │       ├── sse-client.ts
│   │       └── typing-engine.ts
│   ├── tests/
│   ├── index.html
│   ├── vite.config.ts
│   ├── svelte.config.js
│   └── package.json
├── server/
│   ├── src/
│   │   ├── index.ts
│   │   ├── app.ts                     ← Express app factory for testing
│   │   ├── db.ts
│   │   ├── repositories/
│   │   │   ├── messages.ts
│   │   │   ├── sessions.ts
│   │   │   └── stats.ts
│   │   ├── llm/
│   │   │   └── lmstudio-client.ts
│   │   ├── agent/
│   │   │   ├── system-prompt.ts
│   │   │   ├── context.ts
│   │   │   └── action-parser.ts
│   │   └── routes/
│   │       ├── chat.ts
│   │       ├── session.ts
│   │       ├── messages.ts
│   │       ├── stats.ts
│   │       └── health.ts
│   ├── tests/
│   ├── vitest.config.ts
│   └── package.json
├── types/                             ← plain directory, NOT a workspace
│   ├── index.ts
│   ├── api.ts
│   ├── database.ts
│   ├── sse.ts
│   └── state.ts
├── package.json                       ← workspaces: [client, server] only
└── docs/
    ├── PRD.md
    └── PLAN.md
```

---

## Verification

After sequential phases (Epics 1, 2, gate):
1. `npm test` — all unit + integration tests pass
2. `npm run build` — clean production build

During parallel execution (Epics 3–5):
1. Agent A: `npm run test:server` — server tests pass (MUST NOT use root `npm test`)
2. Agent B: `npm run test:client` — client tests pass (MUST NOT use root `npm test`)

After Epic 6 (final):

Final verification (Epic 6):
1. Start LMStudio with Qwen 2.5 7B
2. `npm run dev` — both client and server start
3. Open browser → existing messages load, greeting appears
4. Say "let's practice" → typing session triggers
5. Complete session → metrics card + heatmap + coaching feedback appear (linked via `session_id`)
6. Say "again" → new session starts
7. Kill LMStudio → offline banner within 2s
8. Restart LMStudio → auto-reconnects within 30s
