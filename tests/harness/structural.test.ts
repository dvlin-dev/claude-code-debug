/**
 * Structural Harness Tests
 *
 * Validates project integrity: required files exist, configs are valid,
 * build outputs are correct, and no import cycles break the system.
 * These tests act as guardrails to catch drift and misconfiguration.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");

function exists(p: string): boolean {
  return fs.existsSync(path.join(ROOT, p));
}

function readJSON(p: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf-8"));
}

describe("Project Structure", () => {
  const requiredFiles = [
    // Config
    "package.json",
    "electron.vite.config.ts",
    "vitest.config.ts",
    "tsconfig.json",
    "tsconfig.node.json",
    "electron-builder.yml",
    "components.json",

    // Shared layer
    "src/shared/defaults.ts",
    "src/shared/ipc-channels.ts",
    "src/shared/strip-xml.ts",
    "src/shared/electron-api.ts",
    "src/shared/contracts/provider.ts",
    "src/shared/contracts/profile.ts",
    "src/shared/contracts/capture.ts",
    "src/shared/contracts/normalized.ts",
    "src/shared/contracts/inspector.ts",
    "src/shared/contracts/session.ts",
    "src/shared/contracts/protocol.ts",
    "src/shared/contracts/view-models.ts",
    "src/shared/contracts/events.ts",
    "src/shared/contracts/index.ts",
    "src/shared/electron-api.ts",

    // Main process
    "src/main/index.ts",
    "src/main/bootstrap/app-bootstrap.ts",
    "src/main/capture/body-codec.ts",
    "src/main/ipc/register-ipc.ts",
    "src/main/providers/provider-catalog.ts",
    "src/main/providers/format-provider-label.ts",
    "src/main/providers/protocol-adapters/shared/parse-utils.ts",
    "src/main/providers/protocol-adapters/shared/build-inspector-sections.ts",
    "src/main/providers/protocol-adapters/anthropic-messages/index.ts",
    "src/main/providers/protocol-adapters/openai-responses/index.ts",
    "src/main/pipeline/capture-pipeline.ts",
    "src/main/pipeline/session-resolver.ts",
    "src/main/queries/session-query-service.ts",
    "src/main/queries/exchange-query-service.ts",
    "src/main/storage/history-maintenance-service.ts",
    "src/main/storage/profile-store.ts",
    "src/main/storage/sqlite.ts",
    "src/main/storage/session-repository.ts",
    "src/main/storage/exchange-repository.ts",
    "src/main/transport/forwarder.ts",
    "src/main/transport/listener.ts",
    "src/main/transport/proxy-manager.ts",

    // Preload
    "src/preload/index.ts",
    "src/preload/api.d.ts",

    // Renderer
    "src/renderer/index.html",
    "src/renderer/src/main.tsx",
    "src/renderer/src/App.tsx",
    "src/renderer/src/index.css",
    "src/renderer/src/stores/app-store.ts",
    "src/renderer/src/stores/profile-store.ts",
    "src/renderer/src/stores/session-store.ts",
    "src/renderer/src/stores/trace-store.ts",
    "src/renderer/src/lib/electron-api.ts",
    "src/renderer/src/pages/workspace-page.tsx",
    "src/renderer/src/features/profiles/profile-form.tsx",
    "src/renderer/src/features/profiles/profile-setup-page.tsx",
    "src/renderer/src/components/status-bar.tsx",
    "src/renderer/src/components/session-sidebar.tsx",
    "src/renderer/src/components/main-content.tsx",
    "src/renderer/src/components/conversation-header.tsx",
    "src/renderer/src/components/conversation-view.tsx",
    "src/renderer/src/components/inspector-panel.tsx",
    "src/renderer/src/components/message-block.tsx",
    "src/renderer/src/components/content-block.tsx",
    "src/renderer/src/components/error-boundary.tsx",
    "src/renderer/src/hooks/use-proxy-events.ts",
  ];

  it("all required source files exist", () => {
    const missing = requiredFiles.filter((f) => !exists(f));
    expect(missing).toEqual([]);
  });
});

describe("Package Configuration", () => {
  const pkg = readJSON("package.json") as Record<string, unknown>;

  it("has correct app metadata", () => {
    expect(pkg.name).toBe("agent-trace");
    expect(pkg.type).toBe("module");
    expect(pkg.main).toBe("out/main/index.js");
  });

  it("has all required scripts", () => {
    const scripts = pkg.scripts as Record<string, string>;
    expect(scripts.dev).toBeDefined();
    expect(scripts.build).toBeDefined();
    expect(scripts.typecheck).toBeDefined();
    expect(scripts.test).toBeDefined();
  });

  it("has critical runtime dependencies", () => {
    const deps = pkg.dependencies as Record<string, string>;
    for (const dep of [
      "react",
      "react-dom",
      "zustand",
      "better-sqlite3",
      "sonner",
    ]) {
      expect(deps[dep]).toBeDefined();
    }
  });

  it("has critical dev dependencies", () => {
    const devDeps = pkg.devDependencies as Record<string, string>;
    for (const dep of [
      "electron",
      "electron-vite",
      "vite",
      "typescript",
      "vitest",
    ]) {
      expect(devDeps[dep]).toBeDefined();
    }
  });
});

describe("Dependency Layer Enforcement", () => {
  /**
   * Enforce that the renderer layer never directly imports from main process,
   * and shared layer doesn't import from main or renderer.
   */
  function getImports(filePath: string): string[] {
    const content = fs.readFileSync(path.join(ROOT, filePath), "utf-8");
    const matches = content.match(/from\s+["']([^"']+)["']/g) || [];
    return matches.map((m) => m.replace(/from\s+["']/, "").replace(/["']$/, ""));
  }

  it("shared layer does not import from main or renderer", () => {
    const sharedFiles = [
      "src/shared/defaults.ts",
      "src/shared/ipc-channels.ts",
      "src/shared/electron-api.ts",
      "src/shared/contracts/provider.ts",
      "src/shared/contracts/profile.ts",
      "src/shared/contracts/capture.ts",
      "src/shared/contracts/normalized.ts",
      "src/shared/contracts/inspector.ts",
      "src/shared/contracts/session.ts",
      "src/shared/contracts/protocol.ts",
      "src/shared/contracts/view-models.ts",
      "src/shared/contracts/events.ts",
      "src/shared/contracts/index.ts",
    ];

    for (const file of sharedFiles) {
      const imports = getImports(file);
      const violations = imports.filter(
        (i) => i.includes("/main/") || i.includes("/renderer/"),
      );
      expect(violations, `${file} should not import from main/renderer`).toEqual([]);
    }
  });

  it("renderer does not import from main process (except shared)", () => {
    const rendererDir = path.join(ROOT, "src/renderer/src");
    const tsxFiles = walkDir(rendererDir, [".ts", ".tsx"]);

    for (const file of tsxFiles) {
      const relPath = path.relative(ROOT, file);
      const imports = getImports(relPath);
      const violations = imports.filter(
        (i) =>
          i.includes("/main/") &&
          !i.includes("/shared/"),
      );
      expect(
        violations,
        `${relPath} should not import from main process`,
      ).toEqual([]);
    }
  });

  it("renderer only uses normalized message block names", () => {
    const rendererFiles = [
      "src/renderer/src/components/conversation-view.tsx",
      "src/renderer/src/components/content-block.tsx",
      "src/renderer/src/components/message-block.tsx",
    ];

    for (const file of rendererFiles) {
      const content = fs.readFileSync(path.join(ROOT, file), "utf-8");
      expect(content, `${file} should not use Anthropic block names`).not.toMatch(
        /tool_use|tool_result/,
      );
    }
  });

  it("source tree does not expose unimplemented providers", () => {
    expect(exists("src/main/providers/definitions/gemini.ts")).toBe(false);

    const providerContract = fs.readFileSync(
      path.join(ROOT, "src/shared/contracts/provider.ts"),
      "utf-8",
    );
    expect(providerContract).not.toContain('"gemini"');
    expect(providerContract).not.toContain('"google-generative-language"');
  });

  it("renderer copy is provider-neutral", () => {
    const rendererFiles = [
      "src/renderer/src/components/proxy-instructions.tsx",
      "src/renderer/src/components/empty-state.tsx",
    ];

    for (const file of rendererFiles) {
      const content = fs.readFileSync(path.join(ROOT, file), "utf-8");
      expect(content, `${file} should not mention Claude Code`).not.toContain(
        "Claude Code",
      );
    }
  });
});

describe("IPC Contract Integrity", () => {
  it("all IPC channels are unique", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "src/shared/ipc-channels.ts"),
      "utf-8",
    );
    const channelMatches = content.match(/"[^"]+"/g) || [];
    const channels = channelMatches.map((c) => c.replace(/"/g, ""));
    const uniqueChannels = new Set(channels);
    expect(channels.length).toBe(uniqueChannels.size);
  });

  it("preload exposes matching API for all invoke channels", () => {
    const preloadContent = fs.readFileSync(
      path.join(ROOT, "src/preload/index.ts"),
      "utf-8",
    );
    const ipcContent = fs.readFileSync(
      path.join(ROOT, "src/shared/ipc-channels.ts"),
      "utf-8",
    );

    // Extract invoke channels (not push events)
    const invokeChannels =
      ipcContent.match(
        /(?:OPEN_|EXPORT_|IMPORT_|GET_|SAVE_|START_|STOP_|LIST_|CLEAR_|CHECK_|DOWNLOAD_|QUIT_)[A-Z_]+/g,
      ) || [];

    for (const channel of invokeChannels) {
      expect(
        preloadContent,
        `Preload should reference IPC.${channel}`,
      ).toContain(`IPC.${channel}`);
    }
  });
});

describe("Electron Config", () => {
  it("electron.vite.config externalizes better-sqlite3", () => {
    const config = fs.readFileSync(
      path.join(ROOT, "electron.vite.config.ts"),
      "utf-8",
    );
    expect(config).toContain("better-sqlite3");
    expect(config).toContain("externalizeDeps");
  });

  it("preload builds as CJS for sandbox compatibility", () => {
    const config = fs.readFileSync(
      path.join(ROOT, "electron.vite.config.ts"),
      "utf-8",
    );
    expect(config).toContain('"cjs"');
  });

  it("main process references preload as .js (CJS output)", () => {
    const mainIndex = fs.readFileSync(
      path.join(ROOT, "src/main/index.ts"),
      "utf-8",
    );
    expect(mainIndex).toContain('preload/index.js"');
    expect(mainIndex).not.toContain('preload/index.mjs"');
  });
});

describe("CSS Theme Variables", () => {
  it("index.css defines all required theme variables", () => {
    const css = fs.readFileSync(
      path.join(ROOT, "src/renderer/src/index.css"),
      "utf-8",
    );
    const requiredVars = [
      "--background",
      "--foreground",
      "--primary",
      "--secondary",
      "--muted",
      "--accent",
      "--border",
      "--input",
      "--ring",
    ];
    for (const v of requiredVars) {
      expect(css, `CSS should define ${v}`).toContain(v);
    }
  });
});

describe("Resizable Panel Config", () => {
  it("workspace-page uses string percentage sizes (not px numbers)", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "src/renderer/src/pages/workspace-page.tsx"),
      "utf-8",
    );
    // Should NOT have defaultSize={25} (number = pixels in v4)
    expect(content).not.toMatch(/defaultSize=\{[0-9]+\}/);
    // Should have defaultSize="25%" (string = percentage)
    expect(content).toMatch(/defaultSize="[0-9]+%"/);
  });

  it("main-content uses string percentage sizes (not px numbers)", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "src/renderer/src/components/main-content.tsx"),
      "utf-8",
    );
    expect(content).not.toMatch(/defaultSize=\{[0-9]+\}/);
    expect(content).toMatch(/defaultSize="[0-9]+%"/);
  });
});

// Utility: walk directory for files with given extensions
function walkDir(dir: string, exts: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}
