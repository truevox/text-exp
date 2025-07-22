import { join, dirname } from "path";
import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const EXT_PATH = join(__dirname, "build");

/**
 * Playwright configuration for Chrome extension testing
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./tests/playwright",
  timeout: 40000,
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ["html"],
    ["json", { outputFile: "playwright-report/results.json" }],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
    /* Take screenshot on failure */
    screenshot: "only-on-failure",
    /* Record video on failure */
    video: "retain-on-failure",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium-extension",
      use: {
        ...devices["Desktop Chrome"],
        headless: false,
        channel: "chrome",
        launchOptions: {
          args: [
            `--disable-extensions-except=${EXT_PATH}`,
            `--load-extension=${EXT_PATH}`,
            "--disable-web-security",
            "--disable-features=VizDisplayCompositor",
          ],
        },
      },
    },
    {
      name: "manual",
      use: {
        ...devices["Desktop Chrome"],
        headless: false,
        channel: "chrome",
        // Use your existing Chrome profile with extensions
        launchOptions: {
          args: [
            "--disable-web-security",
            "--disable-features=VizDisplayCompositor",
            // Allow Playwright to work with existing browser
          ],
        },
      },
    },
  ],

  /* Web server for E2E tests - disabled for debug test */
  // webServer: {
  //   command: "npm run serve:test",
  //   port: 5173,
  //   reuseExistingServer: !process.env.CI,
  // },
});
