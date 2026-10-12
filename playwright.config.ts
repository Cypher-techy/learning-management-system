import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a dedicated, disposable database. It is wiped
 * and re-seeded before every run, so it must never point at real data:
 * `tests/e2e/global-setup.ts` refuses any database whose name does not end
 * in "_e2e".
 */
export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgres://lms:lms_local_dev@127.0.0.1:5544/lms_e2e";

export const e2eEnv = {
  DATABASE_URL: E2E_DATABASE_URL,
  NEXT_PUBLIC_APP_URL: E2E_BASE_URL,
  BETTER_AUTH_SECRET: "e2e-only-secret-e2e-only-secret-e2e-only-1234",
  REQUIRE_EMAIL_VERIFICATION: "false",
  STORAGE_DRIVER: "local",
  STORAGE_LOCAL_DIR: ".storage-e2e",
  PAYMENT_PROVIDER: "sandbox",
  SMTP_HOST: "",
  CGS_WEBSITE_URL: "",
  SEED_PASSWORD: "e2e-password-123",
  // Honoured only because the address above is localhost. See isProductionRuntime().
  E2E_TEST_MODE: "true",
};

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  // The scenarios build on one another's data, so they run in order.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Set PW_CHANNEL=msedge or PW_CHANNEL=chrome to use an installed browser
  // instead of the one downloaded by `npx playwright install chromium`.
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: process.env.PW_CHANNEL || undefined } }],
  webServer: {
    // A production build: fast and closest to what is deployed. Build first
    // with `npm run build` (`npm run test:e2e` does this for you).
    command: `node node_modules/next/dist/bin/next start -p ${E2E_PORT}`,
    url: `${E2E_BASE_URL}/api/health`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: e2eEnv,
    stdout: "pipe",
    stderr: "pipe",
  },
});
