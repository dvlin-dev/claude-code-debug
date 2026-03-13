import { test, expect } from "@playwright/test";
import { _electron as electron } from "@playwright/test";
import path from "path";

test.describe("First Run", () => {
  test("shows setup page on first launch", async () => {
    // This test requires the app to be built first
    // Skip if not in CI or if the build artifacts don't exist
    const appPath = path.resolve(__dirname, "../../out/main/index.js");

    const electronApp = await electron.launch({
      args: [appPath],
      env: {
        ...process.env,
        NODE_ENV: "test",
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState("domcontentloaded");

    // Should show the setup page with TARGET_URL input
    const heading = window.locator("text=Agent Trace");
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Should have TARGET_URL input
    const input = window.locator('input[placeholder="https://api.anthropic.com"]');
    await expect(input).toBeVisible();

    // Should have Save and Continue button
    const button = window.locator("text=Save and Continue");
    await expect(button).toBeVisible();
    await expect(button).toBeDisabled();

    // Fill in URL and verify button becomes enabled
    await input.fill("https://api.anthropic.com");
    await expect(button).toBeEnabled();

    await electronApp.close();
  });
});
