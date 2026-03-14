import http from "node:http";
import { zstdCompressSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProviderCatalog } from "../../src/main/providers/provider-catalog";
import { anthropicMessagesAdapter } from "../../src/main/providers/protocol-adapters/anthropic-messages";
import { openaiResponsesAdapter } from "../../src/main/providers/protocol-adapters/openai-responses";
import { CapturePipeline } from "../../src/main/pipeline/capture-pipeline";
import { SessionResolver } from "../../src/main/pipeline/session-resolver";
import { ExchangeQueryService } from "../../src/main/queries/exchange-query-service";
import { SessionQueryService } from "../../src/main/queries/session-query-service";
import { ExchangeRepository } from "../../src/main/storage/exchange-repository";
import { HistoryMaintenanceService } from "../../src/main/storage/history-maintenance-service";
import { SessionRepository } from "../../src/main/storage/session-repository";
import { createSqliteDatabase } from "../../src/main/storage/sqlite";
import { forwardRequest } from "../../src/main/transport/forwarder";
import { createProfileListener } from "../../src/main/transport/listener";
import type {
  CapturedExchange,
  ConnectionProfile,
  ProtocolAdapter,
} from "../../src/shared/contracts";
import type Database from "better-sqlite3";

function capturedBody(
  bytes: Buffer,
  contentType: string,
  contentEncoding: string | null = null,
) {
  return {
    bytes,
    contentType,
    contentEncoding,
  };
}

function getAvailablePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = !address || typeof address === "string" ? 0 : address.port;
      server.close(() => resolve(port));
    });
  });
}

function readRequestBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function httpPost(url: string, path: string, body: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path,
        method: "POST",
        headers: { "content-type": "application/json" },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf-8"),
          });
        });
      },
    );
    request.on("error", reject);
    request.end(body);
  });
}

describe("multi-provider integration harness", () => {
  let upstreamServer: http.Server;
  let upstreamPort: number;
  let db: Database.Database;
  let sessionRepository: SessionRepository;
  let exchangeRepository: ExchangeRepository;
  let sessionQuery: SessionQueryService;
  let exchangeQuery: ExchangeQueryService;
  let listener: ReturnType<typeof createProfileListener>;
  let profile: ConnectionProfile;
  let pipeline: CapturePipeline;

  beforeEach(async () => {
    upstreamPort = await getAvailablePort();
    upstreamServer = http.createServer((req, res) => {
      const bodyChunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => bodyChunks.push(chunk));
      req.on("end", () => {
        const body = JSON.parse(Buffer.concat(bodyChunks).toString("utf-8"));
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            role: "assistant",
            model: body.model,
            content: [{ type: "text", text: "Hello from upstream" }],
          }),
        );
      });
    });
    await new Promise<void>((resolve) =>
      upstreamServer.listen(upstreamPort, "127.0.0.1", resolve),
    );

    db = createSqliteDatabase(":memory:");
    sessionRepository = new SessionRepository(db);
    exchangeRepository = new ExchangeRepository(db);

    const providerCatalog = createProviderCatalog();
    const protocolAdapters = new Map<string, ProtocolAdapter>([
      ["anthropic-messages", anthropicMessagesAdapter],
      ["openai-responses", openaiResponsesAdapter],
    ]);

    const historyMaintenance = new HistoryMaintenanceService({
      sessionRepository,
      exchangeRepository,
    });
    pipeline = new CapturePipeline({
      providerCatalog,
      protocolAdapters,
      sessionResolver: new SessionResolver(sessionRepository),
      sessionRepository,
      exchangeRepository,
      historyMaintenance,
    });

    sessionQuery = new SessionQueryService(
      sessionRepository,
      exchangeRepository,
      providerCatalog,
      protocolAdapters,
    );
    exchangeQuery = new ExchangeQueryService(exchangeRepository, providerCatalog);

    profile = {
      id: "anthropic-dev",
      name: "Anthropic Dev",
      providerId: "anthropic",
      upstreamBaseUrl: `http://127.0.0.1:${upstreamPort}`,
      localPort: await getAvailablePort(),
      enabled: true,
      autoStart: false,
    };

    listener = createProfileListener(profile, {
      onRequest: async (activeProfile, req, res) => {
        const startedAt = new Date().toISOString();
        const bodyBuffer = await readRequestBody(req);
        const forwarded = await forwardRequest({
          upstreamBaseUrl: activeProfile.upstreamBaseUrl,
          method: req.method ?? "GET",
          path: req.url ?? "/",
          headers: Object.fromEntries(
            Object.entries(req.headers).map(([key, value]) => [
              key,
              Array.isArray(value) ? value.join(", ") : value,
            ]),
          ),
          body: bodyBuffer,
        });

        res.writeHead(forwarded.statusCode, forwarded.headers);

        const chunks: Buffer[] = [];
        forwarded.response.on("data", (chunk: Buffer) => {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          chunks.push(buf);
          res.write(buf);
        });

        await new Promise<void>((resolve, reject) => {
          forwarded.response.on("end", resolve);
          forwarded.response.on("error", reject);
        });

        res.end();

        const responseBody = Buffer.concat(chunks);
        const exchange: CapturedExchange = {
          exchangeId: crypto.randomUUID(),
          providerId: activeProfile.providerId,
          profileId: activeProfile.id,
          method: req.method ?? "GET",
          path: req.url ?? "/",
          requestHeaders: Object.fromEntries(
            Object.entries(req.headers)
              .filter(([, value]) => value != null)
              .map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : String(value)]),
          ),
          requestBody: capturedBody(
            bodyBuffer,
            String(req.headers["content-type"] ?? "application/json"),
            typeof req.headers["content-encoding"] === "string"
              ? req.headers["content-encoding"]
              : null,
          ),
          responseHeaders: Object.fromEntries(
            Object.entries(forwarded.headers)
              .filter(([, value]) => value != null)
              .map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : String(value)]),
          ),
          responseBody: capturedBody(
            responseBody,
            String(forwarded.headers["content-type"] ?? "application/json"),
            typeof forwarded.headers["content-encoding"] === "string"
              ? forwarded.headers["content-encoding"]
              : null,
          ),
          statusCode: forwarded.statusCode,
          startedAt,
          durationMs: 1,
          requestSize: bodyBuffer.length,
          responseSize: responseBody.length,
        };

        pipeline.process(exchange);
      },
    });

    await listener.start();
  });

  afterEach(async () => {
    if (listener.isRunning()) {
      await listener.stop();
    }
    await new Promise<void>((resolve) => upstreamServer.close(() => resolve()));
    db.close();
  });

  it("captures an anthropic exchange end-to-end and returns a session trace", async () => {
    const result = await httpPost(
      `http://127.0.0.1:${profile.localPort}`,
      "/v1/messages",
      JSON.stringify({
        model: "claude-opus-4-6",
        metadata: { user_id: "user_hash_account__session_uuid-123" },
        messages: [{ role: "user", content: "Hello" }],
      }),
    );

    expect(result.status).toBe(200);

    const sessions = await sessionQuery.listSessions();
    expect(sessions.length).toBe(1);

    const trace = await sessionQuery.getSessionTrace(sessions[0]!.sessionId);
    const detail = await exchangeQuery.getExchangeDetail(trace.exchanges[0]!.exchangeId);

    expect(trace.timeline.messages.length).toBeGreaterThan(0);
    expect(detail?.inspector.sections.length).toBeGreaterThan(0);
  });

  it("captures a zstd-compressed codex exchange end-to-end through the local listener", async () => {
    await listener.stop();

    profile = {
      id: "codex-dev",
      name: "Codex Dev",
      providerId: "codex",
      upstreamBaseUrl: `http://127.0.0.1:${upstreamPort}`,
      localPort: await getAvailablePort(),
      enabled: true,
      autoStart: false,
    };

    await new Promise<void>((resolve) => upstreamServer.close(() => resolve()));
    upstreamServer = http.createServer(async (req, res) => {
      await readRequestBody(req);
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(
        'data: {"type":"response.completed","response":{"id":"resp_1","status":"completed","model":"gpt-5.4","output":[{"id":"msg_1","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"probe"}]}]}}\n\ndata: [DONE]\n',
      );
    });
    await new Promise<void>((resolve) =>
      upstreamServer.listen(upstreamPort, "127.0.0.1", resolve),
    );

    listener = createProfileListener(profile, {
      onRequest: async (activeProfile, req, res) => {
        const startedAt = new Date().toISOString();
        const bodyBuffer = await readRequestBody(req);
        const forwarded = await forwardRequest({
          upstreamBaseUrl: activeProfile.upstreamBaseUrl,
          method: req.method ?? "GET",
          path: req.url ?? "/",
          headers: Object.fromEntries(
            Object.entries(req.headers).map(([key, value]) => [
              key,
              Array.isArray(value) ? value.join(", ") : value,
            ]),
          ),
          body: bodyBuffer,
        });

        res.writeHead(forwarded.statusCode, forwarded.headers);

        const chunks: Buffer[] = [];
        forwarded.response.on("data", (chunk: Buffer) => {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          chunks.push(buf);
          res.write(buf);
        });

        await new Promise<void>((resolve, reject) => {
          forwarded.response.on("end", resolve);
          forwarded.response.on("error", reject);
        });

        res.end();

        const responseBody = Buffer.concat(chunks);
        const exchange: CapturedExchange = {
          exchangeId: crypto.randomUUID(),
          providerId: activeProfile.providerId,
          profileId: activeProfile.id,
          method: req.method ?? "GET",
          path: req.url ?? "/",
          requestHeaders: Object.fromEntries(
            Object.entries(req.headers)
              .filter(([, value]) => value != null)
              .map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : String(value)]),
          ),
          requestBody: {
            bytes: bodyBuffer,
            contentType: String(req.headers["content-type"] ?? "application/json"),
            contentEncoding:
              typeof req.headers["content-encoding"] === "string"
                ? req.headers["content-encoding"]
                : null,
          },
          responseHeaders: Object.fromEntries(
            Object.entries(forwarded.headers)
              .filter(([, value]) => value != null)
              .map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : String(value)]),
          ),
          responseBody: {
            bytes: responseBody,
            contentType: String(forwarded.headers["content-type"] ?? "text/event-stream"),
            contentEncoding:
              typeof forwarded.headers["content-encoding"] === "string"
                ? forwarded.headers["content-encoding"]
                : null,
          },
          statusCode: forwarded.statusCode,
          startedAt,
          durationMs: 1,
          requestSize: bodyBuffer.length,
          responseSize: responseBody.length,
        };

        pipeline.process(exchange);
      },
    });

    await listener.start();

    await new Promise<void>((resolve, reject) => {
      const request = http.request(
        {
          hostname: "127.0.0.1",
          port: profile.localPort,
          path: "/responses",
          method: "POST",
          headers: {
            "content-type": "application/json",
            "content-encoding": "zstd",
            session_id: "session-codex-1",
            "x-codex-turn-metadata":
              '{"turn_id":"turn-codex-1","sandbox":"none"}',
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("end", () => resolve());
        },
      );
      request.on("error", reject);
      request.end(
        zstdCompressSync(
          Buffer.from(
            JSON.stringify({
              model: "gpt-5.4",
              instructions: "You are Codex.",
              input: [
                {
                  type: "message",
                  role: "user",
                  content: [{ type: "input_text", text: "probe" }],
                },
              ],
              tools: [],
              stream: true,
              store: false,
            }),
            "utf-8",
          ),
        ),
      );
    });

    const sessions = await sessionQuery.listSessions({ providerId: "codex" });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.model).toBe("gpt-5.4");
  });
});
