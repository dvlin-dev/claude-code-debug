# Agent Trace — Architecture

## Overview

Electron desktop app that intercepts Claude Code API traffic via a local HTTP proxy, groups requests into conversations, and renders them as a structured chat view.

```
Claude Code CLI  ──HTTP──▶  Proxy (127.0.0.1:8888)  ──HTTP/S──▶  Anthropic API
                                    │
                              Capture & Group
                                    │
                              SQLite + IPC
                                    │
                              Electron Renderer
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop | Electron 33 |
| Build | electron-vite 5 + Vite 7 |
| Renderer | React 19 + TypeScript |
| State | Zustand 5 |
| UI | shadcn/ui + Tailwind CSS 4 + Lucide icons |
| Storage | better-sqlite3 (SQLite WAL mode) |
| Settings | JSON file (`userData/settings.json`) |
| Tests | Vitest + Testing Library + Playwright |

## Triple Build

Electron requires three separate builds. Configured in `electron.vite.config.ts`:

| Target | Format | Entry | Notes |
|--------|--------|-------|-------|
| Main | CJS | `src/main/index.ts` | Node.js runtime, `better-sqlite3` externalized |
| Preload | CJS | `src/preload/index.ts` | **Must be CJS** for Electron sandbox |
| Renderer | ESM | `src/renderer/src/main.tsx` | Vite dev server in dev, bundled in prod |

## Source Layout

```
src/
├── shared/                          # Both main & renderer
│   ├── types.ts                     # AppSettings, SessionSummary, RequestRecord
│   ├── defaults.ts                  # DEFAULT_PROXY_PORT=8888, MAX_REQUESTS=2000
│   ├── ipc-channels.ts             # IPC channel name constants
│   ├── extract-user-text.ts        # Skip <system-reminder> blocks, extract real text
│   └── strip-xml.ts                # Strip XML/HTML tags
│
├── main/                            # Electron main process
│   ├── index.ts                     # App lifecycle, window creation, wiring
│   ├── proxy/
│   │   ├── server.ts               # HTTP proxy: SSE streaming + capture
│   │   ├── forward.ts              # Forward to target (http/https auto-detect)
│   │   └── stream-collector.ts     # Buffer SSE chunks for storage
│   ├── session/
│   │   ├── session-manager.ts      # Assign requests → sessions
│   │   └── derive-session.ts       # Content-based matching (fallback)
│   ├── store/
│   │   ├── database.ts             # SQLite init + schema
│   │   ├── history-store.ts        # Request/session CRUD
│   │   └── settings-store.ts       # JSON settings read/write
│   └── ipc/
│       └── register-ipc.ts         # All IPC handler registration
│
├── preload/
│   ├── index.ts                     # contextBridge: expose electronAPI
│   └── api.d.ts                     # Type declarations for renderer
│
└── renderer/src/
    ├── main.tsx                     # React entry
    ├── App.tsx                      # Routing: SetupPage | WorkspacePage
    ├── stores/
    │   ├── app-store.ts            # Settings, listening state, proxy address
    │   ├── session-store.ts        # Session list, selection, search
    │   └── request-store.ts        # Request list, inspector, raw mode
    ├── hooks/
    │   └── use-proxy-events.ts     # Subscribe to real-time IPC events
    ├── lib/
    │   ├── electron-api.ts         # Type-safe electronAPI wrapper
    │   └── parse-claude-body.ts    # Parse Claude request/response bodies
    ├── pages/
    │   ├── setup-page.tsx          # First-run: configure TARGET_URL
    │   └── workspace-page.tsx      # Main workspace layout
    └── components/
        ├── status-bar.tsx          # Proxy status + copy address + settings
        ├── session-sidebar.tsx     # Session list with search
        ├── main-content.tsx        # Conversation view + optional inspector
        ├── conversation-header.tsx # Title + model badge + Raw/Inspector toggles
        ├── conversation-view.tsx   # Chat-style message rendering
        ├── inspector-panel.tsx     # Request list + system + tools + raw data
        ├── message-block.tsx       # Single message (user/assistant styling)
        ├── content-block.tsx       # Content type rendering (text/thinking/tool_use)
        ├── command-palette.tsx     # Cmd+K search
        └── ui/                     # shadcn/ui generated components
```

## Data Flow

### Request Capture

```
1. Claude Code sends POST /v1/messages to proxy
2. server.ts collects request body + headers
3. server.ts captures socket info (remotePort)
4. forward.ts forwards to TARGET_URL
5. Response streams back:
   - SSE: pipe to client + collect via StreamCollector
   - Non-SSE: buffer, then send
6. Build RequestRecord with full request + response data
7. onRequest callback fires
```

### Session Assignment

```
8.  session-manager.ts receives RequestRecord
9.  Extract metadata.user_id from request body
10. Parse session UUID: "user_<hash>_account__session_<UUID>"
11. Lookup UUID in Map:
    - Found → return existing sessionId
    - Not found → generate new sessionId, store mapping
12. (Fallback for non-Claude-Code clients: content-based matching)
```

### Persistence & UI Update

```
13. history-store.ts saves to SQLite (INSERT request + UPSERT session)
14. history-store.ts prunes if > MAX_REQUESTS
15. IPC sends CAPTURE_UPDATED to renderer with updated session list
16. Zustand stores update → React re-renders
```

## Session Grouping

| Priority | Strategy | Signal |
|----------|----------|--------|
| **1** | `metadata.user_id` | Claude Code embeds `_session_<UUID>` in every request body |
| **2** | System hash + message superset | Same system prompt AND messages grow (content-based) |
| **3** | Message superset only | Messages grow regardless of system prompt changes |
| — | No match | Create new session |

## IPC Contract

```typescript
// src/shared/ipc-channels.ts
const IPC = {
  // Renderer → Main (invoke/handle)
  GET_SETTINGS:          "app:get-settings",
  SAVE_SETTINGS:         "app:save-settings",
  TOGGLE_LISTENING:      "app:toggle-listening",
  GET_PROXY_STATUS:      "app:get-proxy-status",
  LIST_SESSIONS:         "app:list-sessions",
  GET_SESSION_REQUESTS:  "app:get-session-requests",
  GET_REQUEST_DETAIL:    "app:get-request-detail",
  CLEAR_DATA:            "app:clear-data",
  SEARCH:                "app:search",

  // Main → Renderer (send/on)
  CAPTURE_UPDATED:       "proxy:capture-updated",
  PROXY_ERROR:           "proxy:error",
}
```

## SQLite Schema

```sql
CREATE TABLE requests (
  request_id     TEXT PRIMARY KEY,
  session_id     TEXT NOT NULL,
  method         TEXT NOT NULL,
  path           TEXT NOT NULL,
  timestamp      TEXT NOT NULL,
  duration       INTEGER,
  model          TEXT,
  request_headers  TEXT NOT NULL,  -- JSON
  request_body     TEXT,
  response_headers TEXT,           -- JSON
  response_body    TEXT,
  status_code    INTEGER,
  request_size   INTEGER NOT NULL DEFAULT 0,
  response_size  INTEGER
);

CREATE TABLE sessions (
  session_id    TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  started_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  model         TEXT
);

CREATE INDEX idx_requests_session   ON requests(session_id);
CREATE INDEX idx_requests_timestamp ON requests(timestamp DESC);
CREATE INDEX idx_sessions_updated   ON sessions(updated_at DESC);
```

Storage: `~/Library/Application Support/agent-trace/history.db` (macOS)

## UI Layout

```
┌──────────────────────────────────────────────────────────┐
│  Agent Trace          http://127.0.0.1:8888  ● Listening │  ← StatusBar (drag region)
├────────────┬─────────────────────────────────────────────┤
│  Sessions  │  ConversationHeader                        │
│            │  [title] [model] [Raw] [Inspector]         │
│ ▸ Fix auth ├─────────────────────────────────────────────┤
│ ▸ Add test │  ConversationView                          │
│ ▸ Refactor │   USER: fix the bug                        │
│            │   ASSISTANT: I'll look at login.ts          │
│            │     🔧 Read src/login.ts                    │
│            │     ┗ [result] file contents...             │
│            │   ASSISTANT: Found the issue. Fixing now.   │
└────────────┴─────────────────────────────────────────────┘

Inspector open:
┌────────────┬──────────────────┬──────────────┐
│  Sessions  │ ConversationView │  Inspector   │
│            │                  │  Requests(3) │
│            │  USER: ...       │  POST 200    │
│            │  ASST: ...       │  System      │
│            │                  │  Tools (12)  │
│            │                  │  Raw Req/Res │
└────────────┴──────────────────┴──────────────┘
```

## Zustand Stores

**AppStore** — Global app state
- `settings`, `isListening`, `proxyAddress`, `initialized`

**SessionStore** — Session list
- `sessions[]`, `selectedSessionId`, `searchQuery`

**RequestStore** — Current session's requests
- `requests[]`, `selectedRequestId`, `inspectorOpen`, `rawMode`

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Cmd+K` | Command palette |
| `Cmd+\` | Toggle sidebar |
| `↑/↓` | Navigate lists |
| `Enter` | Select item |
| `Escape` | Close dialog/palette |

## Scripts

```bash
pnpm dev        # Dev mode (auto-rebuilds better-sqlite3 for Electron)
pnpm build      # Production build
pnpm test       # Vitest (requires system Node build of better-sqlite3)
pnpm harness    # Harness tests only (structural + integration)
pnpm typecheck  # Dual tsconfig (renderer + node)
```

## Gotchas

- **better-sqlite3**: `electron-rebuild` compiles for Electron Node; `node-gyp rebuild` compiles for system Node. `predev` script handles Electron rebuild automatically; `pnpm test` needs system Node build.
- **Preload must be CJS**: Electron sandbox requires CommonJS. Output format set in `electron.vite.config.ts`. Main references `../preload/index.js` (not `.mjs`).
- **react-resizable-panels v4**: Numbers = pixels, strings = percentages. Use `defaultSize="25%"` not `defaultSize={25}`. Use `orientation` not `direction`.
