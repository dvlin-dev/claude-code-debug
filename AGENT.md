# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

Agent Trace — an Electron desktop app that captures and inspects agent traffic from multiple providers. Profile-based runtime: each profile binds one provider, one upstream base URL, and one local listener port. Provider-specific parsing is isolated in the main process; the renderer only consumes normalized view models.

## Development Commands

```bash
# Development
pnpm dev              # Run in dev mode (auto-rebuilds better-sqlite3 for Electron)
pnpm build            # Production build
pnpm typecheck        # Type check both renderer and node code

# Testing
pnpm test             # Run all Vitest tests (requires system Node build of better-sqlite3)
pnpm test:watch       # Watch mode
pnpm harness          # Run harness tests only (structural + integration)
pnpm e2e              # Run Playwright e2e tests

# Packaging
pnpm pack             # Build and package (no distribution)
pnpm dist:mac         # Build macOS .dmg and .zip
pnpm release:mac      # Full release: bump version, tag, push (triggers CI)

# Native module rebuilds
pnpm rebuild:electron # Rebuild better-sqlite3 for Electron (auto-runs in predev)
pnpm rebuild:node     # Rebuild better-sqlite3 for system Node (needed before pnpm test)
```

## Architecture

### Triple Build System

Electron requires three separate builds (configured in `electron.vite.config.ts`):

1. **Main** (CJS) — `src/main/index.ts` — Node.js runtime, `better-sqlite3` externalized
2. **Preload** (CJS) — `src/preload/index.ts` — **Must be CJS** for Electron sandbox
3. **Renderer** (ESM) — `src/renderer/src/main.tsx` — React app, Vite dev server in dev

### Data Flow

```
Agent Client
  └─▶ Profile Listener (local port)
        └─▶ Forwarder → Upstream Provider
              │
              ▼
        CapturedExchange
              │
              ▼
        ProtocolAdapter
          normalize + buildInspector
              │
              ▼
        CapturePipeline
          SessionResolver → SQLite Repositories
              │
              ▼
        Query Services → IPC / Preload → Renderer VM
```

### Session Grouping Strategy

Each protocol adapter owns a `SessionMatcher`. Resolution priority:

**Anthropic (`anthropic-messages`):**
1. `metadata.user_id` — Claude Code embeds `_session_<UUID>` in every request
2. System hash + message superset — Same system prompt AND messages grow
3. Message superset only — Messages grow regardless of system prompt
4. No match → Create new session

**Codex (`openai-responses`):**
1. `session_id` request header
2. `conversation` field in request body
3. No match → Create new session

### Key Directories

- `src/shared/contracts/` — All cross-layer type contracts
  - `provider.ts` — `ProviderId`, `ProviderDefinition`, `ProtocolAdapterId`
  - `profile.ts` — `ConnectionProfile`
  - `capture.ts` — `CapturedExchange`, `CapturedBody`
  - `normalized.ts` — `NormalizedExchange`, `NormalizedMessage`, `EndpointKind`
  - `inspector.ts` — `InspectorDocument`, `InspectorSection`
  - `session.ts` — `SessionMatcher`, `TimelineAssembler`, `SessionTimeline`
  - `protocol.ts` — `ProtocolAdapter` interface
  - `view-models.ts` — `SessionListItemVM`, `SessionTraceVM`, `ExchangeDetailVM`
  - `events.ts` — `TraceCapturedEvent` (incremental), `ProfileStatusChangedEvent`
- `src/shared/defaults.ts` — Constants: `DEFAULT_PROFILE_PORT_START=8888`, `DEFAULT_MAX_STORED_EXCHANGES=5000`
- `src/shared/ipc-channels.ts` — IPC channel name constants
- `src/main/bootstrap/app-bootstrap.ts` — Wires everything: catalog, adapters, pipeline, queries, proxy manager
- `src/main/transport/` — HTTP listener, forwarder, proxy manager (protocol-unaware)
- `src/main/providers/definitions/` — Provider metadata (anthropic, codex)
- `src/main/providers/protocol-adapters/` — Per-protocol: normalize, buildInspector, sessionMatcher, timelineAssembler
- `src/main/pipeline/` — `CapturePipeline` (normalize → inspect → resolve → persist), `SessionResolver`
- `src/main/storage/` — SQLite schema, repositories (session, exchange), profile-store (JSON), history-maintenance
- `src/main/queries/` — `SessionQueryService`, `ExchangeQueryService` → return view models
- `src/main/ipc/register-ipc.ts` — All IPC handlers
- `src/preload/index.ts` — Electron preload bridge
- `src/renderer/src/stores/` — Zustand: app-store, profile-store, session-store, trace-store
- `src/renderer/src/hooks/use-proxy-events.ts` — Push event handler
- `src/renderer/src/features/profiles/` — Profile setup UI

## Supported Providers

- `anthropic` — adapter: `anthropic-messages`, default upstream: `https://api.anthropic.com`
- `codex` — adapter: `openai-responses`, default upstream: `https://chatgpt.com/backend-api/codex`

No other providers are currently implemented. Adding a new provider requires: a definition in `definitions/`, an adapter in `protocol-adapters/`, and registering both in `provider-catalog.ts` and `app-bootstrap.ts`.

## Critical Gotchas

### better-sqlite3 Native Module

- **Electron build**: `electron-rebuild` compiles for Electron's Node version (auto-runs in `predev`)
- **System Node build**: `node-gyp rebuild` compiles for system Node (required before `pnpm test`)
- If tests fail with native module errors, run `pnpm rebuild:node` first

### Preload Must Be CJS

- Electron sandbox requires CommonJS format
- Output format enforced in `electron.vite.config.ts`
- Main process references `../preload/index.js` (not `.mjs`)

### react-resizable-panels v4 API

- Numbers = pixels, strings = percentages
- Use `defaultSize="25%"` not `defaultSize={25}`
- Use `orientation` prop, not `direction`

## Storage Locations

- **SQLite database**: `~/Library/Application Support/agent-trace/agent-trace.db` (macOS)
- **Profiles file**: `~/Library/Application Support/agent-trace/profiles.json`
- **Auto-prunes**: After 5000 exchanges (`DEFAULT_MAX_STORED_EXCHANGES`)

## Release Process

Only macOS releases are currently supported:

1. Run `./scripts/release.sh <version>` locally
2. Script bumps version, commits, tags, and pushes
3. GitHub Actions (`.github/workflows/release-macos.yml`) builds, signs, notarizes
4. Artifacts uploaded to GitHub Releases: `.dmg`, `.zip`, `latest-mac.yml`, blockmaps
5. App auto-updates via `electron-updater` + GitHub provider

Required GitHub secrets for signing/notarization:
- `CSC_LINK` — Developer ID Application .p12 (base64)
- `CSC_KEY_PASSWORD` — .p12 password
- `APPLE_API_KEY` — App Store Connect API key .p8
- `APPLE_API_KEY_ID` — API key ID
- `APPLE_API_ISSUER` — Issuer ID

## Proxy Configuration

Users create a profile in the app, start its listener, then point the agent client at the local address:

```bash
# Anthropic profile on port 8888
export ANTHROPIC_BASE_URL=http://127.0.0.1:8888

# Codex profile on port 8889
export OPENAI_BASE_URL=http://127.0.0.1:8889
```

The forwarder preserves the upstream pathname and appends the original request path:
- Upstream: `http://example.com/api`
- Request: `/v1/messages?beta=true`
- Forwarded to: `http://example.com/api/v1/messages?beta=true`
