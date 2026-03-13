import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const read = (relativePath: string) =>
  fs.readFile(path.join(ROOT, relativePath), "utf8");

describe("macOS release config", () => {
  it("exposes local packaging and release scripts", async () => {
    const pkg = JSON.parse(await read("package.json")) as {
      scripts?: Record<string, string>;
    };

    expect(pkg.scripts?.pack).toBe(
      "pnpm build && node ./scripts/run-electron-builder.cjs --dir",
    );
    expect(pkg.scripts?.dist).toBe(
      "pnpm build && node ./scripts/run-electron-builder.cjs",
    );
    expect(pkg.scripts?.["dist:mac"]).toBe(
      "pnpm build && node ./scripts/run-electron-builder.cjs --mac",
    );
    expect(pkg.scripts?.["release:mac"]).toBe("bash ./scripts/release.sh");
  });

  it("configures electron-builder for signed macOS releases", async () => {
    const config = await read("electron-builder.yml");

    expect(config).toContain("icon: resources/icon.icns");
    expect(config).toContain(
      "artifactName: Agent-Trace-${version}-${arch}.${ext}",
    );
    expect(config).toContain("hardenedRuntime: true");
    expect(config).toContain("gatekeeperAssess: false");
    expect(config).toContain("entitlements: build/entitlements.mac.plist");
    expect(config).toContain("entitlementsInherit: build/entitlements.mac.plist");
    expect(config).toContain("publish:");
    expect(config).toContain("provider: github");
    expect(config).toContain("owner: dvlin-dev");
    expect(config).toContain("repo: agent-trace");
  });

  it("includes release helper scripts and signing entitlements", async () => {
    await expect(read("scripts/run-electron-builder.cjs")).resolves.toContain(
      "electron-builder/cli.js",
    );
    await expect(read("scripts/release.sh")).resolves.toContain(
      "用法: ./scripts/release.sh <version>",
    );
    await expect(read("scripts/release.sh")).resolves.toContain("pnpm rebuild:node");
    await expect(read("scripts/release.sh")).resolves.toContain("pnpm typecheck");
    await expect(read("scripts/release.sh")).resolves.toContain("pnpm test");
    await expect(read("build/entitlements.mac.plist")).resolves.toContain(
      "com.apple.security.cs.allow-jit",
    );
  });

  it("defines a GitHub Actions workflow for macOS releases", async () => {
    const workflow = await read(".github/workflows/release-macos.yml");

    expect(workflow).toContain("name: Release macOS");
    expect(workflow).toContain("tags:");
    expect(workflow).toContain("- 'v*.*.*'");
    expect(workflow).toContain("runs-on: macos-14");
    expect(workflow).toContain("CSC_LINK: ${{ secrets.CSC_LINK }}");
    expect(workflow).toContain(
      "APPLE_API_KEY_CONTENT: ${{ secrets.APPLE_API_KEY }}",
    );
    expect(workflow).toContain(
      "pnpm exec node ./scripts/run-electron-builder.cjs --mac dmg zip --arm64 --publish never",
    );
    expect(workflow).toContain("uses: softprops/action-gh-release@v2");
    expect(workflow).toContain("dist/*.dmg.blockmap");
    expect(workflow).toContain("dist/*.zip.blockmap");
    expect(workflow).toContain("dist/latest-mac.yml");
  });
});
