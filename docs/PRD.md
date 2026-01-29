# Athena — Product Requirements Document

> **Athena is your daily coach and assistant.**

**Version:** 0.3 (PoC — Final)
**Status:** Approved
**Last Updated:** 2026-01-28

---

## 1. Product Vision

Athena is a personal AI agent that owns its interface. Unlike traditional apps where AI is a feature, Athena **is** the product — a conversational agent that controls what the user sees, when, and why.

The user interacts exclusively through chat. Athena decides what UI to render based on the conversation: a typing exercise, session results, or just a message. The interface is a reflection of the agent's decisions, not a static layout.

**PoC Goal:** Prove the agent-controlled UI paradigm works with one capability — typing practice.

**Long-term Vision:** A comprehensive AI Life Copilot with multiple capabilities (typing, IELTS prep with voice I/O, and beyond). Athena grows by gaining new abilities, not new pages.

---

## 2. User Persona

| Attribute | Value |
|-----------|-------|
| **User** | Single user (the developer) |
| **Keyboard layout** | Workman |
| **Goal** | Improve typing speed and accuracy through coached practice |
| **Interaction style** | Conversational, expects the agent to be direct and honest |
| **Platform** | Web browser (PoC), Mac/Windows/iOS (future) |

---

## 3. Agent Specification

### 3.1 Personality

Athena is a human-like friend who helps you reach your goals. She is:

- **Direct and honest** — does not sugarcoat feedback. Will call out mistakes, declining performance, or laziness.
- **Knowledgeable** — speaks from data. References actual metrics, trends, and history.
- **Warm but firm** — supportive tone, but never sycophantic. Encouragement is earned.

**Example interactions:**

| Scenario | Athena says |
|----------|-------------|
| User completes session, accuracy dropped | "72% accuracy. That's below your average. Your 'q' and 'z' keys are dragging you down — want me to set up a targeted drill?" |
| User says "Hey" | "Hey. Ready to practice, or just checking in?" |
| User asks about progress | "Over the last week: your WPM went from 62 to 68, but accuracy dipped from 94% to 89%. Speed is improving, but you're trading precision for it. I'd focus on accuracy for the next few sessions." |

### 3.2 Context Assembly (PoC)

No persistent memory system in PoC. Athena's context per request includes:

- **System prompt** — personality, instructions, response format
- **Typing statistics** — aggregated from DB: recent session averages (WPM, accuracy), top 5 weakest keys (by avg time), top 5 weakest bigrams, total session count, best WPM
- **Last 10 messages** — last 10 rows where `role IN ('user', 'assistant')`, ordered by timestamp descending. System messages and greeting triggers are excluded from the context count.

**Context budget:** Qwen 2.5 7B supports up to 32K context. Target context usage:
- System prompt: ~500 tokens
- Typing statistics block: ~200 tokens
- Last 10 messages: ~1500 tokens
- **Total target: ≤ 2500 tokens** (well within limits)

**Note:** The system prompt is a critical deliverable. It defines Athena's personality, response style, when to trigger actions, and how to use typing statistics. It will require iterative refinement during development — treat it as a first-class artifact, not an implementation detail.

Future: Add persistent memory system (facts, patterns, corrections) with vector DB retrieval.

### 3.3 Greeting Behavior

On app open, the client sends a system-level request to `/api/chat` with a trigger `"type": "greeting"`. The server assembles context (typing stats, time of day, days since last session) and asks the LLM to generate a greeting. This appears as Athena's first message in the chat.

**First launch (zero data):** When there are no sessions and no messages in the DB, the greeting context includes a flag `"firstLaunch": true`. The system prompt instructs Athena to introduce herself briefly and ask what the user wants to work on. Example: "Hey, I'm Athena. I'll be your typing coach. Ready to see where you stand? Let's do a quick session."

**Returning user:** Greeting context includes days since last session, recent performance trends, and session count. Athena references these naturally.

---

## 4. Capabilities

### 4.1 Typing Practice (PoC Capability)

**Session flow:**

```
User sends message (e.g., "Let's practice")
         │
         ▼
┌─────────────────────────┐
│  Express: /api/chat     │
│  - Assemble context     │
│  - Send to LLM          │
│  - Stream text response  │
│  - Extract action        │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  SSE Events to Client   │
│  1. event: text (token) │  ← streamed as LLM generates
│  2. event: text (token) │
│  ...                     │
│  N. event: done          │  ← signals end of text
│  N+1. event: action      │  ← parsed action (if any)
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Client: receives action │
│  type: start_typing      │
│  → fullscreen typing UI  │
└────────┬────────────────┘
         │
    User types or presses Escape
         │
         ├── Complete: POST /api/session (save metrics)
         │   then POST /api/chat with trigger "type": "session_complete"
         │   + session metrics payload
         │   → Athena responds with coaching feedback
         │
         └── Cancel: discard, return to chat, no API calls
```

**Known limitation (PoC):** The post-session flow makes two sequential HTTP requests (save session, then request coaching feedback). If the second request fails (LLM timeout, error), the session is saved but no coaching feedback appears. The user can retry by sending a message like "how did I do?" Atomic post-session handling is deferred to a future version.

**Text generation:**
- Practice text is embedded in the action payload, generated by the LLM as part of the response
- 2-3 sentences, natural English prose
- System prompt instructs the LLM to incorporate weak keys/bigrams (provided in context)
- No validation that target keys appear — accept LLM best-effort for PoC

**Metrics captured per session:**

| Metric | Description |
|--------|-------------|
| WPM | Words per minute: (characters typed / 5) / elapsed minutes |
| Accuracy | (correct keystrokes / total keystrokes) × 100 |
| Errors | Total error count (cumulative, not decremented on backspace) |
| Characters | Total characters typed |
| Duration | Elapsed time in milliseconds |
| Per-key timing | Average milliseconds per key (lowercase normalized). Stored aggregated per session. |
| Bigram timing | Average milliseconds per two-character sequence. Stored aggregated per session. |

**Post-session display (in chat):**
- Metrics summary card: WPM, accuracy, errors, duration
- Keyboard heatmap (Workman layout, color-coded by speed)
- Athena's coaching feedback (2-3 sentences)

**Rich message rendering:** When the client renders a message with a non-null `session_id`, it fetches the linked session data (including key/bigram stats) and renders the metrics card + heatmap component instead of plain text. Athena's coaching text is stored in the message `content` field and rendered below the rich components.

**Between-session behavior:** After results are shown, the user continues chatting freely. Athena handles follow-up requests naturally via the LLM:
- "Again" / "One more" → Athena generates new practice text (triggers action)
- "That was too easy" / "Harder" → Athena adjusts text complexity in the next session
- "What are my weak keys?" → Athena references stats from context
- Any other topic → Normal conversation, no action triggered

No special logic is needed — these are handled by the LLM with appropriate system prompt instructions.

**Session cancellation:**
- Escape key cancels immediately
- No confirmation dialog (short sessions — 2-3 sentences)
- All data discarded, return to chat silently

---

## 5. Technical Architecture

### 5.1 Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Svelte 5 (Vite) |
| **Backend** | Node.js + Express |
| **LLM** | Qwen 2.5 7B Instruct via LMStudio (OpenAI-compatible API, local) |
| **Agent protocol** | Free text streaming + server-side action extraction |
| **Streaming** | Server-Sent Events (SSE) |
| **Persistence** | SQLite via better-sqlite3 |
| **Styling** | Tailwind CSS |

### 5.2 Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                    Svelte App                        │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │               Chat View (default)              │  │
│  │  - Message history (last 10 loaded on open)    │  │
│  │  - Scroll up to load older chunks              │  │
│  │  - Rich content: metrics cards, heatmap        │  │
│  │  - Input field at bottom                       │  │
│  │  - Styled loading indicator during LLM wait    │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │          Typing View (fullscreen)              │  │
│  │  - Char-by-char text with real-time feedback   │  │
│  │  - Direct DOM manipulation (not reactive)      │  │
│  │  - keydown listener on window                  │  │
│  │  - Escape to cancel                            │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │           App State (Svelte stores)            │  │
│  │  currentView: 'chat' | 'typing'               │  │
│  │  messages: Message[]                           │  │
│  │  connectionStatus: 'connected' | 'error'      │  │
│  │  isLoading: boolean                            │  │
│  └────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────┤
│                  Express Server                      │
│                                                      │
│  Endpoints:                                          │
│  ┌────────────────────────────────────────────────┐  │
│  │ GET  /api/health      → LMStudio health check  │  │
│  │ POST /api/chat        → SSE stream response    │  │
│  │ POST /api/session     → save typing session    │  │
│  │ GET  /api/messages    → paginated history      │  │
│  │ GET  /api/stats       → aggregated metrics     │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  Agent Engine:                                       │
│  ┌────────────────────────────────────────────────┐  │
│  │ - Build system prompt + stats + last 10 msgs   │  │
│  │ - Call LMStudio (stream tokens)                │  │
│  │ - Forward tokens to client via SSE             │  │
│  │ - On completion: extract action from full text  │  │
│  │ - Send action event via SSE                    │  │
│  │ - Retry on failure (up to 2 retries)           │  │
│  │ - Fallback: plain text, no action              │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │              SQLite Database                    │  │
│  │  messages, sessions, key_stats, bigram_stats   │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### 5.3 Agent Response Protocol

**Strategy: Free text streaming + post-completion action extraction.**

The LLM generates natural text freely — no JSON output required. The system prompt instructs the LLM to embed actions using a simple marker format within its response.

**LLM output format (instructed via system prompt):**

When Athena wants to trigger a typing session, she writes her message naturally and ends with:

```
[ACTION:typing_session]
The practice text goes here. This is the text the user will type.
[/ACTION]
```

When no action is needed, Athena just responds normally with no markers.

**Action marker handling:**

The LLM is instructed to always place action markers at the very end of its response. Action markers will be streamed to the client as raw tokens (the server does not buffer or filter mid-stream). The client handles display cleanup:

1. Server streams all tokens from LMStudio to client via SSE as they arrive
2. Server buffers the full response in parallel
3. On stream completion:
   - Parse the buffered text for `[ACTION:...]...[/ACTION]` markers
   - If action found: send `event: action` with extracted data
   - If no action found: send `event: done`
4. Client receives `action` event → strips action markers from the displayed message text
5. Server saves assistant message to DB (without action markers)

**SSE Event Types:**

| Event | Data | Description |
|-------|------|-------------|
| `text` | `{"token": "..."}` | Single token from LLM stream |
| `action` | `{"type": "start_typing_session", "text": "..."}` | Extracted action after stream completes |
| `done` | `{}` | Stream complete, no action |
| `error` | `{"message": "...", "code": "..."}` | Error occurred |

**SSE client implementation note:** Since `/api/chat` uses `POST`, the browser's native `EventSource` API cannot be used (it only supports `GET`). The client must use `fetch()` with `ReadableStream` parsing or a library like `eventsource-parser` to process the SSE stream from a POST response.

**Retry & Fallback:**

| Scenario | Behavior |
|----------|----------|
| LMStudio unreachable | Return `error` event with message "Athena is offline. Make sure LMStudio is running." |
| LLM returns empty response | Retry up to 2 times. If still empty, return `error` event. |
| Action markers malformed | Ignore markers, treat entire response as plain text message. No action triggered. |
| LLM timeout (>30 seconds) | Abort request, return `error` event with message "Response took too long. Try again." |
| Action text empty | Ignore action, treat as plain text message. |

### 5.4 Health Check

**Endpoint:** `GET /api/health`

On app open and every 30 seconds thereafter, the client pings `/api/health`, which checks:
1. LMStudio reachable at configured endpoint (`GET /v1/models`)
2. At least one model is loaded

**States:**

| Status | UI Behavior |
|--------|-------------|
| `connected` | Normal operation. Green status indicator (subtle, top corner). |
| `error` | Chat input disabled. Banner: "Athena is offline — LMStudio is not running." Retry every 30s. |

No offline mode. The app requires LMStudio to function.

### 5.5 Data Model

**messages**
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| role | TEXT | 'user' \| 'assistant' \| 'system' |
| content | TEXT | Message text (markdown) |
| session_id | INTEGER FK | Nullable. Links to session if this message contains session results. |
| timestamp | INTEGER | Unix timestamp ms |

**sessions**
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| wpm | REAL | Words per minute |
| accuracy | REAL | Percentage (0-100) |
| errors | INTEGER | Total errors |
| characters | INTEGER | Total characters typed |
| duration_ms | INTEGER | Elapsed time in milliseconds |
| text | TEXT | The practice text |
| timestamp | INTEGER | Unix timestamp ms |

**key_stats**
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| key | TEXT | Single character (lowercase) |
| avg_time_ms | REAL | Average milliseconds for this key in this session |
| sample_count | INTEGER | Number of keystrokes for this key in this session |
| session_id | INTEGER FK | Reference to session |

Indexes: `(key)`, `(session_id)`

**bigram_stats**
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| bigram | TEXT | Two-character sequence |
| avg_time_ms | REAL | Average milliseconds for this bigram in this session |
| sample_count | INTEGER | Number of occurrences in this session |
| session_id | INTEGER FK | Reference to session |

Indexes: `(bigram)`, `(session_id)`

**Configuration (environment variables, no settings table for PoC):**

| Variable | Default | Description |
|----------|---------|-------------|
| `LMSTUDIO_URL` | `http://localhost:1234/v1` | LMStudio API endpoint |
| `PORT` | `3000` | Express server port |

Keyboard layout is hardcoded to Workman. Settings persistence deferred to v0.2+.

### 5.6 API Endpoints

**POST /api/chat**
```
Request:
{
  "message": "Let's practice",        // user message (omit for greeting)
  "trigger": "greeting" | "session_complete" | null,
  "sessionData": { ... } | null       // metrics payload for session_complete trigger
}

Response: SSE stream (see 5.3 for event types)
```

**POST /api/session**
```
Request:
{
  "wpm": 65.2,
  "accuracy": 91.4,
  "errors": 8,
  "characters": 142,
  "duration_ms": 34200,
  "text": "The practice text...",
  "keyStats": { "a": { "avgTime": 120, "count": 5 }, ... },
  "bigramStats": { "th": { "avgTime": 95, "count": 3 }, ... }
}

Response: { "id": 42 }
```

**GET /api/messages?before={timestamp}&limit={count}**
```
Response:
{
  "messages": [ ... ],
  "hasMore": true
}
```
Default limit: 20. Used for chunked loading on scroll.

**GET /api/stats**
```
Response:
{
  "totalSessions": 42,
  "recentAvgWpm": 65.2,        // last 10 sessions
  "recentAvgAccuracy": 91.4,   // last 10 sessions
  "bestWpm": 78.0,
  "weakestKeys": [             // top 5 by avg time
    { "key": "q", "avgTime": 280 },
    ...
  ],
  "weakestBigrams": [          // top 5 by avg time
    { "bigram": "zx", "avgTime": 350 },
    ...
  ]
}
```

**GET /api/health**
```
Response:
{
  "status": "connected" | "error",
  "model": "qwen2.5-7b-instruct" | null,
  "error": "Connection refused" | null
}
```

---

## 6. UI Specification

### 6.1 Design Language

- **Theme:** Dark cyberpunk
- **Background:** Deep dark (`#0a0a0f` or similar)
- **Primary accent:** Electric cyan (`#00f0ff`)
- **Secondary accent:** Neon magenta (`#ff00aa`)
- **Error:** Hot red (`#ff3366`)
- **Success:** Neon green (`#00ff88`)
- **Text:** Light gray (`#e0e0e0`), dimmed (`#666680`)
- **Typography:**
  - Agent messages: monospace (JetBrains Mono or similar)
  - Typing view: monospace
  - UI labels: sans-serif (Inter or system)
- **Effects:**
  - Subtle glow (`box-shadow`) on active/focused elements using accent colors
  - Smooth transitions (200-300ms) between views
  - Loading indicator: pulsing dots or typing animation in accent color

### 6.2 Chat View (default)

```
┌──────────────────────────────────────┐
│ ● Athena connected              [·] │  ← status bar (minimal)
├──────────────────────────────────────┤
│                                      │
│  ↑ scroll to load older messages     │
│                                      │
│  ┌─ Athena ─────────────────────┐   │
│  │ Hey. Ready to practice?      │   │
│  └──────────────────────────────┘   │
│                                      │
│  ┌─ You ────────────────────────┐   │
│  │ Let's go                     │   │
│  └──────────────────────────────┘   │
│                                      │
│  ┌─ Athena ─────────────────────┐   │
│  │ Alright. Your 'q' and 'z'   │   │
│  │ are still slow. Here's a    │   │
│  │ text that'll hit those.     │   │
│  │                              │   │
│  │ ● Loading indicator...       │   │  ← while streaming
│  └──────────────────────────────┘   │
│                                      │
│  ┌─ Session Results ────────────┐   │  ← rich content block
│  │  WPM: 68  ACC: 91%          │   │
│  │  Errors: 4  Time: 34s       │   │
│  │  ┌─────────────────────┐    │   │
│  │  │   Keyboard Heatmap  │    │   │
│  │  └─────────────────────┘    │   │
│  │  Athena: "Better. Your 'z'  │   │
│  │  improved but watch 'q'."   │   │
│  └──────────────────────────────┘   │
│                                      │
├──────────────────────────────────────┤
│  Type a message...            [Send] │
└──────────────────────────────────────┘
```

- Messages load most recent first. Scroll up triggers `/api/messages?before={oldest_timestamp}` to load older chunks.
- While LLM is streaming, show tokens appearing in real-time in the assistant message bubble.
- While waiting for first token, show a styled loading indicator (pulsing dots).
- Chat input is disabled while LLM is processing.
- When `connectionStatus` is `error`, input is disabled with overlay message.

### 6.3 Typing View (fullscreen takeover)

```
┌──────────────────────────────────────┐
│                                      │
│                                      │
│                                      │
│   The quick brown fox jumps over     │
│   the lazy dog while gazing at       │
│   the quartz sphinx.                 │
│          ▲                           │
│        cursor                        │
│                                      │
│                                      │
│                                      │
│              [Esc to cancel]         │  ← subtle hint, dimmed
└──────────────────────────────────────┘
```

**Character states:**
| State | Style |
|-------|-------|
| Correct | Cyan accent color |
| Incorrect | Magenta/red, subtle underline |
| Current | Bright white with glow cursor |
| Upcoming | Dimmed gray |

**Input handling:**
- `keydown` listener on `window` (not a hidden input element — avoids IME/autocomplete issues)
- Typing engine runs outside Svelte reactivity. Uses direct DOM manipulation for character color updates to avoid reactive re-renders on every keystroke.
- Svelte reactivity used only for: view transitions, final stats computation.
- Backspace: delete last character
- Ctrl/Alt+Backspace: delete last word
- Escape: cancel session, return to chat
- On final character typed: session complete → transition to chat

### 6.4 Keyboard Heatmap

Rendered inline within session result messages in chat.

- **Layout:** Workman keyboard layout (hardcoded)
- **Rendering:** CSS grid of styled `<div>` elements (not Canvas/SVG)
- **Color scale:** 5 levels based on the user's own timing range for that session
  - Fastest 20%: neon green
  - 20-40%: cyan
  - 40-60%: yellow
  - 60-80%: orange
  - Slowest 20%: magenta/red
- **Untyped keys:** Dark/neutral, no color
- **Highlight:** Top 3 slowest keys get a glow border
- **Data source:** Per-key averages from the completed session (computed client-side from session data)

### 6.5 Loading & Error States

| State | UI |
|-------|-----|
| App opening, waiting for greeting | Chat area empty, pulsing Athena avatar or logo, "Connecting..." |
| Waiting for LLM first token | Assistant message bubble appears with pulsing dots animation |
| LLM streaming | Tokens appear in real-time in the message bubble |
| LMStudio offline | Banner at top: "Athena is offline — LMStudio is not running." Input disabled. Auto-retry every 30s. |
| LLM timeout (>30s) | Error message in chat: "That took too long. Try sending your message again." |
| LLM error (malformed/empty) | After retries exhausted: "Something went wrong. Try again." shown as system message in chat. |

---

## 7. Scope Boundaries

### In Scope (PoC)

- Chat-based agent interaction with SSE streaming
- Agent-controlled UI (chat ↔ typing view)
- Single typing practice capability
- Text generation by agent (targeting weak areas, best-effort)
- Full metrics capture (WPM, accuracy, errors, duration, per-key, bigram)
- Keyboard heatmap (Workman, inline in chat)
- Session results displayed as rich chat messages
- Greeting on app open (context-aware via typing stats)
- Persistent data: messages, sessions, key/bigram stats
- Health check with graceful error handling
- Retry/fallback for LLM failures
- Chunked message history loading
- Dark cyberpunk visual style
- Styled loading indicators for all async operations

### Out of Scope (PoC)

- Persistent memory system (facts, patterns, corrections)
- Proactive suggestions (beyond greeting)
- User accounts / authentication
- Cloud sync
- Multiple capabilities (IELTS, etc.)
- Voice input/output
- Slash commands
- Settings UI
- Onboarding flow
- Mobile-responsive design
- Multiple keyboard layouts
- Export/import data
- Training plans / multi-session flows
- Offline mode

---

## 8. Recommended Build Order

Build sequence is ordered to validate the highest-risk assumption first: **Can a 7B local model reliably control a UI through conversation?**

| Step | What | Validates |
|------|------|-----------|
| 1 | Express server + SQLite schema + LMStudio proxy | LLM communication works |
| 2 | Agent engine: system prompt + context assembly + action extraction | The paradigm — LLM can trigger actions reliably |
| 3 | Chat UI with SSE streaming | Streaming UX feels responsive |
| 4 | Typing engine: keystroke capture + metrics (port logic from v0.1) | Performance-critical input handling in Svelte |
| 5 | Integration: chat → action → typing → save → coaching feedback | Full loop works end-to-end |
| 6 | Rich messages: metrics cards + keyboard heatmap | Session results display correctly |
| 7 | Polish: cyberpunk styling, loading states, error handling, health check | Production-quality feel |

**Steps 1-3 prove or disprove the core hypothesis.** If the 7B model can't reliably trigger actions after step 2, you know early and can adjust (swap models, change protocol, add structured output).

---

## 9. Known Limitations (PoC)

| # | Limitation | Impact | Future fix |
|---|-----------|--------|------------|
| 1 | Post-session save + coaching are two separate requests | If coaching request fails, session is saved but no feedback appears | Atomic endpoint or queue (v0.2) |
| 2 | Action markers may briefly appear in streamed text | User sees `[ACTION:...]` for a moment before client strips them | Buffered streaming or faster client cleanup |
| 3 | No conversation boundary | "Last 10 messages" spans all time, no session/day separation | Conversation sessions with boundaries (v0.2) |
| 4 | LLM may not include target weak keys in generated text | Practice text may not actually focus on weak areas | Validation + regeneration or post-processing (v0.2) |
| 5 | Single concurrent request | If user sends messages rapidly, behavior is undefined | Request queue with debouncing (v0.2) |

---

## 10. Future Roadmap (Post-PoC)

| Phase | Capability |
|-------|------------|
| **v0.2** | Persistent memory (facts, patterns), proactive behavior, slash commands |
| **v0.3** | Settings via chat, training plans, multi-session flows |
| **v0.4** | IELTS preparation (reading, writing sections) |
| **v0.5** | Voice I/O — speaking and listening capabilities |
| **v0.6** | Tauri wrapper — native Mac/Windows app |
| **v1.0** | Multi-capability AI Life Copilot |

---

## 11. Success Criteria (PoC)

| # | Criterion | Measurable target |
|---|-----------|-------------------|
| 1 | Chat works | User sends a message, Athena responds with streamed text within 15 seconds |
| 2 | Typing session triggers | Athena correctly triggers a typing session (action extracted) in ≥ 8/10 requests |
| 3 | Typing input performance | Keystroke-to-visual-feedback latency < 16ms (one frame at 60fps) |
| 4 | Metrics accuracy | WPM and accuracy values match manual calculation within 1% margin |
| 5 | Post-session coaching | Athena's feedback references actual session metrics (WPM, accuracy, weak keys) |
| 6 | Data persistence | Sessions, messages, and stats survive browser refresh and app restart |
| 7 | Error resilience | LMStudio offline → user sees clear error message within 2 seconds, no crash |
| 8 | UI transitions | Chat ↔ Typing view transition completes in < 300ms |
