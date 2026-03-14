# Agent Trace Architecture

## Overview

Agent Trace is a profile-based multi-provider trace desktop app.

```text
Agent Client
  └─▶ Profile Listener (local port)
        └─▶ Forwarder
              └─▶ Upstream Provider
                    │
                    ▼
             CapturedExchange
                    │
                    ▼
              ProtocolAdapter
        normalize + buildInspector
        sessionMatcher + timelineAssembler
                    │
                    ▼
             SQLite Repositories
                    │
                    ▼
               Query Services
                    │
                    ▼
                IPC / Preload
                    │
                    ▼
                 Renderer VM
```

The main process owns transport, protocol semantics, session grouping, inspector construction, persistence, and query assembly. The renderer only renders view models.

## Core Decisions

- One profile binds one provider, one upstream base URL, and one local port.
- Provider-specific parsing only happens in the main process.
- Raw exchanges and normalized exchanges are both stored.
- Inspector documents are stored as a sibling artifact, not embedded in renderer parsing.
- Session matching is provider-aware and stateful.
- Timeline assembly happens in query time, not in the renderer.
- No mixed-provider session model.
- No legacy settings or migration layer in the runtime design.

## Layers

### Shared Contracts

`src/shared/contracts/*`

- `ProviderDefinition`
- `ConnectionProfile`
- `CapturedExchange`
- `NormalizedExchange`
- `InspectorDocument`
- `SessionMatcher`
- `TimelineAssembler`
- renderer view models
- push event payloads

These contracts are the only stable boundary between main, preload, and renderer.

### Main Process

`src/main/*`

#### Bootstrap

`src/main/bootstrap/app-bootstrap.ts`

- Creates provider catalog
- Registers protocol adapters
- Creates SQLite database and repositories
- Wires capture pipeline, query services, and proxy manager
- Emits `TRACE_CAPTURED` and `PROFILE_STATUS_CHANGED`

#### Transport

`src/main/transport/*`

- `listener.ts`: owns local HTTP listener per profile
- `forwarder.ts`: forwards one request upstream and returns a full response buffer
- `proxy-manager.ts`: starts and stops listeners by profile

Transport does not understand provider protocols.

#### Provider Runtime

`src/main/providers/*`

- `definitions/*`: product/provider metadata
- `protocol-adapters/*`: protocol parsing and session/timeline logic

Current adapters:

- `anthropic-messages`
- `openai-responses`

#### Pipeline

`src/main/pipeline/*`

- `capture-pipeline.ts`
  - normalize
  - buildInspector
  - resolve session
  - persist session + exchange
- `session-resolver.ts`
  - uses adapter-owned `SessionMatcher`

#### Storage

`src/main/storage/*`

- `sqlite.ts`
- `profile-store.ts`
- `session-repository.ts`
- `exchange-repository.ts`

SQLite stores:

- profiles in JSON file
- sessions table
- exchanges table
- normalized JSON
- inspector JSON

#### Queries

`src/main/queries/*`

- `session-query-service.ts`
- `exchange-query-service.ts`

Query services return:

- `SessionListItemVM`
- `SessionTraceVM`
- `ExchangeDetailVM`

### IPC / Preload

`src/main/ipc/register-ipc.ts`
`src/preload/index.ts`

Invoke channels:

- `GET_PROFILES`
- `SAVE_PROFILES`
- `START_PROFILE`
- `STOP_PROFILE`
- `GET_PROFILE_STATUSES`
- `LIST_SESSIONS`
- `GET_SESSION_TRACE`
- `GET_EXCHANGE_DETAIL`
- `CLEAR_HISTORY`
- update channels

Push channels:

- `TRACE_CAPTURED`
- `PROFILE_STATUS_CHANGED`
- `PROXY_ERROR`
- `UPDATE_STATE_CHANGED`

### Renderer

`src/renderer/src/*`

Renderer responsibilities:

- profile setup and management
- session list rendering
- timeline rendering from normalized VM
- inspector rendering from stored inspector sections
- live update consumption via push events

Renderer does not parse raw provider bodies.

## Provider Model

### Anthropic

- Provider id: `anthropic`
- Default upstream: `https://api.anthropic.com`
- Adapter: `anthropic-messages`
- Session hint: `metadata.user_id`
- Timeline strategy: snapshot-style

### Codex

- Provider id: `codex`
- Default upstream: `https://chatgpt.com/backend-api/codex`
- Adapter: `openai-responses`
- Session hint: `session_id` request header
- Turn hint: `x-codex-turn-metadata`
- Timeline strategy: incremental
- Local listener currently captures the HTTP fallback path after Codex probes `/responses` over WebSocket

## Data Flow

### Capture Path

1. A profile listener receives a request.
2. The forwarder sends it to the configured upstream.
3. Main builds a `CapturedExchange`.
4. `CapturePipeline` loads the profile's adapter.
5. Adapter normalizes the exchange and builds inspector sections.
6. `SessionResolver` assigns or creates a session.
7. Repositories persist session and exchange rows.
8. Query service refreshes the session list.
9. Main emits `TRACE_CAPTURED`.

### Read Path

1. Renderer requests sessions or a trace via preload.
2. Query services load rows from repositories.
3. Adapter-owned `TimelineAssembler` builds session timeline.
4. Query services return view models.
5. Renderer renders timeline and inspector directly from VM.

## Source Layout

```text
src/
├── shared/contracts/
├── main/
│   ├── bootstrap/
│   ├── ipc/
│   ├── pipeline/
│   ├── providers/
│   │   ├── definitions/
│   │   └── protocol-adapters/
│   ├── queries/
│   ├── storage/
│   └── transport/
├── preload/
└── renderer/src/
    ├── features/profiles/
    ├── stores/
    ├── hooks/
    ├── pages/
    └── components/
```

## Verification Targets

- Unit tests for each protocol adapter
- Integration harness for listener → forwarder → pipeline → storage → query
- Renderer tests for profile setup, workspace rendering, and live updates
- Playwright first-run test
