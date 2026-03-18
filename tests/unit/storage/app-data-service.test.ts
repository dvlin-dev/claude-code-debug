import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  APP_DATA_ARCHIVE_FORMAT,
  APP_DATA_SCHEMA_VERSION,
} from "../../../src/shared/app-data";
import {
  createZipArchive,
  extractZipArchive,
} from "../../../src/main/storage/app-data-archive";
import { AppDataService } from "../../../src/main/storage/app-data-service";
import { ProfileStore } from "../../../src/main/storage/profile-store";

describe("app data service", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      rmSync(tempDirs.pop()!, { recursive: true, force: true });
    }
  });

  it("exports profiles, sessions and exchanges to a backup file", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "agent-trace-app-data-"));
    tempDirs.push(tempDir);

    const profileStore = new ProfileStore(join(tempDir, "profiles.json"));
    const sessionRepository = {
      listSessions: vi.fn().mockReturnValue([
        {
          session_id: "session-1",
          provider_id: "anthropic",
          profile_id: "anthropic-dev",
          external_hint: "hint-1",
          title: "Hello",
          model: "claude-opus-4-6",
          started_at: "2026-03-13T00:00:00.000Z",
          updated_at: "2026-03-13T00:00:01.000Z",
          exchange_count: 1,
          matcher_state_json: "{\"foo\":\"bar\"}",
        },
      ]),
      transaction: vi.fn((fn: () => unknown) => fn()),
      clearAll: vi.fn(),
      insertRows: vi.fn(),
    } as never;
    const exchangeRepository = {
      listAll: vi.fn().mockReturnValue([
        {
          exchange_id: "exchange-1",
          session_id: "session-1",
          provider_id: "anthropic",
          profile_id: "anthropic-dev",
          method: "POST",
          path: "/v1/messages",
          started_at: "2026-03-13T00:00:00.000Z",
          duration_ms: 120,
          status_code: 200,
          request_size: 10,
          response_size: 12,
          raw_request_headers_json: "{\"content-type\":\"application/json\"}",
          raw_request_body: Buffer.from("{\"ok\":true}", "utf-8"),
          raw_response_headers_json: "{\"content-type\":\"application/json\"}",
          raw_response_body: Buffer.from("{\"done\":true}", "utf-8"),
          normalized_json: "{\"model\":\"claude-opus-4-6\"}",
          inspector_json: "{\"sections\":[]}",
        },
      ]),
      clearAll: vi.fn(),
      insertRows: vi.fn(),
    } as never;
    const proxyManager = {
      getStatuses: vi.fn().mockReturnValue({}),
      startProfile: vi.fn(),
      stopProfile: vi.fn(),
    } as never;

    const service = new AppDataService({
      appVersion: "0.3.5",
      profileStore,
      sessionRepository,
      exchangeRepository,
      proxyManager,
    });

    profileStore.saveProfiles([
      {
        id: "anthropic-dev",
        name: "Anthropic Dev",
        providerId: "anthropic",
        upstreamBaseUrl: "https://api.anthropic.com",
        localPort: 8888,
        enabled: true,
        autoStart: true,
      },
    ]);

    const filePath = join(tempDir, "backup.zip");
    const result = service.exportToFile(filePath);
    const archiveEntries = extractZipArchive(readFileSync(filePath));
    const manifest = archiveEntries.get("manifest.json")?.toString("utf-8") ?? "";

    expect(result).toEqual({
      filePath,
      profileCount: 1,
      sessionCount: 1,
      exchangeCount: 1,
    });
    expect(Array.from(archiveEntries.keys())).toEqual(
      expect.arrayContaining([
        "manifest.json",
        "profiles/anthropic-dev.json",
        "history/anthropic-dev/sessions.json",
        "history/anthropic-dev/exchanges.json",
      ]),
    );
    expect(manifest).toContain(APP_DATA_ARCHIVE_FORMAT);
    expect(manifest).toContain(APP_DATA_SCHEMA_VERSION.toString());
  });

  it("imports a backup file and restarts imported auto-start profiles", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "agent-trace-app-data-"));
    tempDirs.push(tempDir);

    const profileStore = new ProfileStore(join(tempDir, "profiles.json"));
    const insertedSessions: unknown[] = [];
    const insertedExchanges: unknown[] = [];
    const sessionRepository = {
      transaction: vi.fn((fn: () => unknown) => fn()),
      clearAll: vi.fn(),
      insertRows: vi.fn((rows: unknown[]) => {
        insertedSessions.push(...rows);
      }),
      listSessions: vi.fn().mockReturnValue([]),
    } as never;
    const exchangeRepository = {
      clearAll: vi.fn(),
      insertRows: vi.fn((rows: unknown[]) => {
        insertedExchanges.push(...rows);
      }),
      listAll: vi.fn().mockReturnValue([]),
    } as never;
    const proxyManager = {
      getStatuses: vi.fn().mockReturnValue({
        "old-profile": { isRunning: true, port: 9999 },
      }),
      startProfile: vi.fn().mockResolvedValue(undefined),
      stopProfile: vi.fn().mockResolvedValue(undefined),
    } as never;

    const service = new AppDataService({
      appVersion: "0.3.5",
      profileStore,
      sessionRepository,
      exchangeRepository,
      proxyManager,
    });

    const filePath = join(tempDir, "import.zip");
    const archiveManifest = {
      schemaVersion: APP_DATA_SCHEMA_VERSION,
      format: APP_DATA_ARCHIVE_FORMAT,
      appVersion: "0.3.5",
      exportedAt: "2026-03-13T00:00:00.000Z",
      profiles: [
        {
          profileId: "anthropic-dev",
          profileFile: "profiles/anthropic-dev.json",
          sessionsFile: "history/anthropic-dev/sessions.json",
          exchangesFile: "history/anthropic-dev/exchanges.json",
        },
      ],
    };
    const tarEntries = [
      {
        name: "manifest.json",
        content: Buffer.from(JSON.stringify(archiveManifest, null, 2), "utf-8"),
      },
      {
        name: "profiles/anthropic-dev.json",
        content: Buffer.from(
          JSON.stringify(
            {
              id: "anthropic-dev",
              name: "Anthropic Dev",
              providerId: "anthropic",
              upstreamBaseUrl: "https://api.anthropic.com",
              localPort: 8888,
              enabled: true,
              autoStart: true,
            },
            null,
            2,
          ),
          "utf-8",
        ),
      },
      {
        name: "history/anthropic-dev/sessions.json",
        content: Buffer.from(
          JSON.stringify(
            [
              {
                session_id: "session-1",
                provider_id: "anthropic",
                profile_id: "anthropic-dev",
                external_hint: "hint-1",
                title: "Hello",
                model: "claude-opus-4-6",
                started_at: "2026-03-13T00:00:00.000Z",
                updated_at: "2026-03-13T00:00:01.000Z",
                exchange_count: 1,
                matcher_state_json: "{\"foo\":\"bar\"}",
              },
            ],
            null,
            2,
          ),
          "utf-8",
        ),
      },
      {
        name: "history/anthropic-dev/exchanges.json",
        content: Buffer.from(
          JSON.stringify(
            [
              {
                exchange_id: "exchange-1",
                session_id: "session-1",
                provider_id: "anthropic",
                profile_id: "anthropic-dev",
                method: "POST",
                path: "/v1/messages",
                started_at: "2026-03-13T00:00:00.000Z",
                duration_ms: 120,
                status_code: 200,
                request_size: 10,
                response_size: 12,
                raw_request_headers_json: "{\"content-type\":\"application/json\"}",
                raw_request_body_base64: Buffer.from("{\"ok\":true}", "utf-8").toString("base64"),
                raw_response_headers_json: "{\"content-type\":\"application/json\"}",
                raw_response_body_base64: Buffer.from("{\"done\":true}", "utf-8").toString("base64"),
                normalized_json: "{\"model\":\"claude-opus-4-6\"}",
                inspector_json: "{\"sections\":[]}",
              },
            ],
            null,
            2,
          ),
          "utf-8",
        ),
      },
    ];
    writeFileSync(
      filePath,
      createZipArchive(tarEntries),
    );

    const result = await service.importFromFile(filePath);

    expect(result).toEqual({
      filePath,
      profileCount: 1,
      sessionCount: 1,
      exchangeCount: 1,
    });
    expect(proxyManager.stopProfile).toHaveBeenCalledWith("old-profile");
    expect(proxyManager.startProfile).toHaveBeenCalledWith("anthropic-dev");
    expect(profileStore.getProfiles()).toEqual([
      expect.objectContaining({
        id: "anthropic-dev",
        localPort: 8888,
      }),
    ]);
    expect(sessionRepository.clearAll).toHaveBeenCalledTimes(1);
    expect(exchangeRepository.clearAll).toHaveBeenCalledTimes(1);
    expect(insertedSessions).toEqual([
      expect.objectContaining({
        session_id: "session-1",
      }),
    ]);
    expect(insertedExchanges).toEqual([
      expect.objectContaining({
        exchange_id: "exchange-1",
        raw_request_body: expect.any(Buffer),
      }),
    ]);
  });
});
