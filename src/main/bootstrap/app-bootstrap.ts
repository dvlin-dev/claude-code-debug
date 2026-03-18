import http from "node:http";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type {
  CapturedExchange,
  CapturedBody,
  ConnectionProfile,
  ProfileStatusChangedEvent,
  ProtocolAdapter,
  TraceCapturedEvent,
} from "../../shared/contracts";
import { createProviderCatalog, type ProviderCatalog } from "../providers/provider-catalog";
import { anthropicMessagesAdapter } from "../providers/protocol-adapters/anthropic-messages";
import { openaiResponsesAdapter } from "../providers/protocol-adapters/openai-responses";
import { CapturePipeline } from "../pipeline/capture-pipeline";
import { SessionResolver } from "../pipeline/session-resolver";
import { ExchangeQueryService } from "../queries/exchange-query-service";
import { SessionQueryService } from "../queries/session-query-service";
import { ExchangeRepository } from "../storage/exchange-repository";
import { AppDataService } from "../storage/app-data-service";
import { HistoryMaintenanceService } from "../storage/history-maintenance-service";
import { ProfileStore } from "../storage/profile-store";
import { SessionRepository } from "../storage/session-repository";
import { createSqliteDatabase } from "../storage/sqlite";
import { forwardRequest } from "../transport/forwarder";
import { createProxyManager, type ProxyManager } from "../transport/proxy-manager";
import type { AppDataTransferResult } from "../../shared/app-data";

export interface AppBootstrapDependencies {
  userDataPath: string;
  appVersion?: string;
  onTraceCaptured?: (payload: TraceCapturedEvent) => void;
  onProfileStatusChanged?: (payload: ProfileStatusChangedEvent) => void;
  onProfileError?: (message: string) => void;
}

export interface AppBootstrap {
  providerCatalog: ProviderCatalog;
  protocolAdapters: Map<string, ProtocolAdapter>;
  profileStore: ProfileStore;
  proxyManager: ProxyManager;
  sessionQueryService: SessionQueryService;
  exchangeQueryService: ExchangeQueryService;
  exportData(filePath: string): AppDataTransferResult;
  importData(filePath: string): Promise<AppDataTransferResult>;
  getProfiles(): ConnectionProfile[];
  saveProfiles(profiles: ConnectionProfile[]): ConnectionProfile[];
  clearHistory(): void;
  startAutoStartProfiles(): Promise<void>;
  dispose(): Promise<void>;
}

function normalizeHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }
    normalized[key] = Array.isArray(value) ? value.join(", ") : value;
  }
  return normalized;
}

async function readRequestBody(request: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// HTTP hop-by-hop headers that MUST NOT be forwarded by a proxy.
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

function stripHopByHopHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string | string[] | undefined> {
  const result: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      result[key] = value;
    }
  }
  return result;
}

function buildCapturedBody(
  bytes: Buffer,
  headers: Record<string, string>,
): CapturedBody | null {
  if (bytes.length === 0) {
    return null;
  }

  return {
    bytes,
    contentType: headers["content-type"] ?? null,
    contentEncoding: headers["content-encoding"] ?? null,
  };
}

export function createAppBootstrap(
  deps: AppBootstrapDependencies,
): AppBootstrap {
  const providerCatalog = createProviderCatalog();
  const protocolAdapters = new Map<string, ProtocolAdapter>([
    ["anthropic-messages", anthropicMessagesAdapter],
    ["openai-responses", openaiResponsesAdapter],
  ]);
  const profileStore = new ProfileStore(join(deps.userDataPath, "profiles.json"));
  const db: Database.Database = createSqliteDatabase(
    join(deps.userDataPath, "agent-trace.db"),
  );
  const sessionRepository = new SessionRepository(db);
  const exchangeRepository = new ExchangeRepository(db);
  const historyMaintenance = new HistoryMaintenanceService({
    sessionRepository,
    exchangeRepository,
  });
  const sessionResolver = new SessionResolver(sessionRepository);
  const capturePipeline = new CapturePipeline({
    providerCatalog,
    protocolAdapters,
    sessionResolver,
    sessionRepository,
    exchangeRepository,
    historyMaintenance,
  });
  const sessionQueryService = new SessionQueryService(
    sessionRepository,
    exchangeRepository,
    providerCatalog,
    protocolAdapters,
  );
  const exchangeQueryService = new ExchangeQueryService(
    exchangeRepository,
    providerCatalog,
  );

  function emitProfileStatuses(): void {
    deps.onProfileStatusChanged?.({
      statuses: proxyManager.getStatuses(),
    });
  }

  const proxyManager = createProxyManager({
    getProfiles: () => profileStore.getProfiles(),
    listenerDependencies: {
      onRequest: async (profile, request, response) => {
        const startedAtMs = Date.now();
        const requestBodyBuffer = await readRequestBody(request);

        try {
          const forwarded = await forwardRequest({
            upstreamBaseUrl: profile.upstreamBaseUrl,
            method: request.method ?? "GET",
            path: request.url ?? "/",
            headers: request.headers,
            body: requestBodyBuffer,
          });

          response.writeHead(
            forwarded.statusCode,
            stripHopByHopHeaders(forwarded.headers),
          );

          // Single data path: forward each chunk to the client AND collect for capture.
          const chunks: Buffer[] = [];

          forwarded.response.on("data", (chunk: Buffer) => {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            chunks.push(buf);
            if (!response.writableEnded) {
              response.write(buf);
            }
          });

          // Clean up upstream if client disconnects during streaming.
          response.on("close", () => {
            if (!response.writableEnded) {
              forwarded.response.destroy();
            }
          });

          // Wait for the upstream response to finish.
          await new Promise<void>((resolve, reject) => {
            forwarded.response.on("end", resolve);
            forwarded.response.on("error", reject);
          });

          // End client response FIRST — client is fully served at this point.
          response.end();

          // Then process capture in the background — errors here never affect the client.
          const requestHeaders = normalizeHeaders(request.headers);
          const responseHeaders = normalizeHeaders(forwarded.headers);
          const responseBodyBuffer = Buffer.concat(chunks);

          try {
            const capturedExchange: CapturedExchange = {
              exchangeId: randomUUID(),
              providerId: profile.providerId,
              profileId: profile.id,
              method: request.method ?? "GET",
              path: request.url ?? "/",
              requestHeaders,
              requestBody: buildCapturedBody(requestBodyBuffer, requestHeaders),
              responseHeaders,
              responseBody: buildCapturedBody(responseBodyBuffer, responseHeaders),
              statusCode: forwarded.statusCode,
              startedAt: new Date(startedAtMs).toISOString(),
              durationMs: Date.now() - startedAtMs,
              requestSize: requestBodyBuffer.length,
              responseSize: responseBodyBuffer.length,
            };

            const { sessionId } = capturePipeline.process(capturedExchange);
            const updatedSession =
              sessionQueryService.getSessionListItem(sessionId);

            deps.onTraceCaptured?.({
              updatedSession,
              updatedExchangeId: capturedExchange.exchangeId,
            });
          } catch (captureError) {
            console.warn("[capture] Processing failed:", captureError);
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          deps.onProfileError?.(
            `[${profile.name}] Proxy forward error: ${message}`,
          );

          if (!response.headersSent && !response.writableEnded) {
            response.writeHead(502, { "content-type": "text/plain" });
            response.end(`Proxy error: ${message}`);
          } else if (!response.writableEnded) {
            response.end();
          }
        }
      },
      onError: (profile, error) => {
        deps.onProfileError?.(`[${profile.name}] ${error.message}`);
      },
    },
  });

  const appDataService = new AppDataService({
    appVersion: deps.appVersion ?? "0.0.0",
    profileStore,
    sessionRepository,
    exchangeRepository,
    proxyManager,
  });

  return {
    providerCatalog,
    protocolAdapters,
    profileStore,
    proxyManager,
    sessionQueryService,
    exchangeQueryService,
    exportData(filePath) {
      return appDataService.exportToFile(filePath);
    },
    importData(filePath) {
      return appDataService.importFromFile(filePath);
    },

    getProfiles() {
      return profileStore.getProfiles();
    },

    saveProfiles(nextProfiles) {
      profileStore.saveProfiles(nextProfiles);
      emitProfileStatuses();
      return profileStore.getProfiles();
    },

    clearHistory() {
      historyMaintenance.clearAll();
    },

    async startAutoStartProfiles() {
      for (const profile of profileStore.getProfiles()) {
        if (!profile.enabled || !profile.autoStart) {
          continue;
        }

        try {
          await proxyManager.startProfile(profile.id);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          deps.onProfileError?.(`[${profile.name}] ${message}`);
        }
      }

      emitProfileStatuses();
    },

    async dispose() {
      for (const profile of profileStore.getProfiles()) {
        await proxyManager.stopProfile(profile.id);
      }
      db.close();
    },
  };
}
