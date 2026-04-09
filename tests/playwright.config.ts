import { defineConfig, devices } from "@playwright/test";

const CI = !!process.env.CI;
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
/** Mock HTTP API (must match server-side `DJANGO_API_BASE` so RSC/ISR fetches see the same data as route mocks). */
const MOCK_BACKEND =
  process.env.MOCK_BACKEND_URL?.replace(/\/$/, "") || "http://localhost:3001";

const projects: Parameters<typeof defineConfig>[0]["projects"] = [
  { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  { name: "mobile-chrome", use: { ...devices["Pixel 5"] } },
];

if (!CI) {
  projects.push({ name: "iphone-12", use: { ...devices["iPhone 12"] } });
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 2 : 1,
  reporter: CI ? [["github"], ["html", { open: "never" }]] : "list",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    extraHTTPHeaders: { "x-test-env": "playwright" },
  },

  projects,

  webServer: [
    {
      command: "node e2e/fixtures/mock-backend.mjs",
      url: `${MOCK_BACKEND}/health`,
      reuseExistingServer: true,
      timeout: 15_000,
    },
    {
      // Local: start Next with SSR pointed at the mock (same as CI). If you reuse an existing
      // dev server, run: `DJANGO_API_BASE=http://localhost:3001 npm run dev` in ../frontend.
      command: CI ? "npm run start" : "npm run dev",
      cwd: "../frontend",
      url: BASE_URL,
      reuseExistingServer: true,
      timeout: 60_000,
      env: {
        PORT: "3000",
        DJANGO_API_BASE: MOCK_BACKEND,
        NEXT_PUBLIC_API_URL: "/api",
      },
    },
  ],
});