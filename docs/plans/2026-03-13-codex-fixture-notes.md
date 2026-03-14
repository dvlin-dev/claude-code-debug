# Codex Fixture Notes

## Capture Summary

- Capture date: 2026-03-13
- Client: `codex exec`
- Prompt: `Reply with exactly the word probe.`
- Request fixture provenance: real Codex CLI request body captured from a local listener via `OPENAI_BASE_URL=http://127.0.0.1:8891`
- Response fixture provenance: representative `Responses` SSE sample assembled from official OpenAI documentation event shapes, because this environment could capture the real request but could not complete an upstream replay to the Codex backend from shell-side tooling

## Observations

- Codex first attempts a WebSocket upgrade on `GET /responses`
- When the WebSocket handshake fails locally, Codex falls back to HTTP `POST /responses`
- The HTTP request body is `zstd` compressed JSON
- The request is incremental rather than snapshot style:
  - `input` only contains the current developer prompt and current user messages for the turn
  - No prior assistant history is embedded as a full transcript in the sampled request body
- Session hint is carried in headers rather than the JSON body:
  - `session_id`
  - `x-codex-turn-metadata` with `turn_id`
- Tool declarations are standard `function` tools with JSON Schema under `parameters`
- The response protocol uses OpenAI `Responses` streaming event families such as:
  - `response.output_item.added`
  - `response.content_part.added`
  - `response.output_text.delta`
  - `response.output_item.done`
  - `response.done`

## Adapter Implications

- `SessionMatcher` should key on `session_id` first, not body superset matching
- `TimelineAssembler` should treat Codex as incremental and concatenate exchanges in order
- `ProtocolAdapter.normalize()` must parse:
  - request `input[].content[]`
  - request `tools[]`
  - response `response.done` output items
  - streaming fallback from `response.output_text.delta`
- The current runtime only needs HTTP fallback support to capture Codex traffic through the local listener
