import { test, expect } from "@playwright/test";
import { _electron as electron } from "@playwright/test";
import { mkdtemp } from "fs/promises";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe("First Run", () => {
  test("shows setup page on first launch", async () => {
    // This test requires the app to be built first
    // Skip if not in CI or if the build artifacts don't exist
    const appPath = path.resolve(__dirname, "../../out/main/index.js");
    const tempHome = await mkdtemp(path.join(os.tmpdir(), "agent-trace-e2e-"));

    const electronApp = await electron.launch({
      args: [appPath],
      env: {
        ...process.env,
        NODE_ENV: "test",
        HOME: tempHome,
        APPDATA: tempHome,
        XDG_CONFIG_HOME: tempHome,
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState("domcontentloaded");

    // Should show the provider setup page
    const heading = window.locator("text=Agent Trace");
    await expect(heading).toBeVisible({ timeout: 10000 });

    await expect(window.getByText("Connect provider")).toBeVisible();
    await expect(window.getByLabel("Provider")).toBeVisible();
    await expect(window.getByLabel("Upstream base URL")).toBeVisible();
    await expect(window.getByLabel("Local port")).toBeVisible();

    // Should have Add profile button
    const button = window.locator("text=Add profile");
    await expect(button).toBeVisible();

    await electronApp.close();
  });
});
