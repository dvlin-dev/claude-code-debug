# Agent Trace

[中文](./README.zh-CN.md)

A desktop app that captures and inspects agent traffic from multiple providers. The current runtime is profile-based: each profile binds one provider, one upstream base URL, and one local listener port.

## What It Does

Agent Trace runs a local listener in front of agent tooling such as Claude Code and Codex. Requests are forwarded upstream, normalized in the main process, grouped into sessions, persisted to SQLite, and rendered as provider-aware traces in the renderer.

```text
Agent Client  ──▶  Profile Listener (localhost:8888/8889/...)  ──▶  Upstream Provider
                               │
                         Capture + Normalize
                               │
                      SQLite + Query Services
                               │
                         Electron Renderer
```

## What Data You Can See

| Data | Source | How It's Captured |
|------|--------|-------------------|
| **Instructions** | Normalized request blocks | System or developer guidance extracted by the provider adapter |
| **Messages** | Normalized request/response messages | User turns, assistant turns, reasoning blocks, tool calls, tool results |
| **Tools** | Request body | Registered tools and JSON Schemas |
| **Headers** | Raw request headers | Provider-specific routing and session hints |
| **Usage** | Response terminal events | Token accounting when the provider exposes it |
| **Timing & Sizes** | Listener + forwarder | Duration, request size, response size |
| **Raw Payloads** | Stored raw request/response body | Inspector tabs for debugging protocol details |

## How It Works

**Profiles** — A profile defines `providerId`, `upstreamBaseUrl`, `localPort`, and startup behavior. Multiple profiles can run side-by-side.

**Transport Layer** — The main process owns local listeners and forwarding. Each listener captures one full exchange as raw request/response data.

**Protocol Adapters** — Provider-specific parsing happens only in the main process. Adapters normalize raw exchanges, build inspector documents, match sessions, and assemble timelines.

**Storage + Query** — Raw exchanges, normalized exchanges, and inspector documents are stored in SQLite. Query services return view models to the renderer rather than raw rows.

**UI** — Renderer never parses provider bodies. It only consumes `SessionListItemVM`, `SessionTraceVM`, and `ExchangeDetailVM`.

## Supported Providers

- `anthropic`
  - upstream default: `https://api.anthropic.com`
  - protocol adapter: `anthropic-messages`
- `codex`
  - upstream default: `https://chatgpt.com/backend-api/codex`
  - protocol adapter: `openai-responses`
  - current listener flow captures the HTTP fallback path after Codex probes `/responses` over WebSocket

## Setup

```bash
# Install
pnpm install

# Run in dev mode
pnpm dev

# Build for production
pnpm build

# Build a local macOS package
pnpm dist:mac
```

Create a profile in the app, start its listener, then point the client at the listener address.

Example: Anthropic profile on `127.0.0.1:8888`

```bash
export ANTHROPIC_BASE_URL=http://127.0.0.1:8888
```

Example: Codex profile on `127.0.0.1:8889`

```bash
export OPENAI_BASE_URL=http://127.0.0.1:8889
```

Then run the client normally. Captured sessions will appear in the app under the matching provider/profile.

## macOS Release

This project currently supports one release path only:

- build macOS artifacts
- sign and notarize in GitHub Actions
- publish directly to GitHub Releases

### Local release command

```bash
./scripts/release.sh 0.1.0
```

The script will:

1. verify the working tree is clean
2. run `pnpm build`
3. run the release config test
4. bump `package.json` version
5. create a release commit
6. create tag `v<version>`
7. push the branch and tag

Pushing a tag like `v0.1.0` triggers the workflow:

- `.github/workflows/release-macos.yml`

That workflow builds the macOS `arm64` release, signs and notarizes it when secrets are present, and uploads `.dmg` and `.zip` assets to GitHub Releases.

### Required GitHub Actions secrets

Open the GitHub repository and go to:

`Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`

Add these repository secrets:

- `CSC_LINK`
  - base64 content of your exported Developer ID Application `.p12`
- `CSC_KEY_PASSWORD`
  - password for that `.p12`
- `APPLE_API_KEY`
  - App Store Connect API key `.p8` content, either raw PEM or base64
- `APPLE_API_KEY_ID`
  - App Store Connect key ID
- `APPLE_API_ISSUER`
  - App Store Connect issuer ID

Without these secrets, local packaging still works, but notarization is skipped and GitHub Actions cannot produce a properly notarized public release.

## Tech Stack

Electron 33 · React 19 · TypeScript · Zustand · shadcn/ui · better-sqlite3 · electron-vite
