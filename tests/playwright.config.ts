import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const CI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI ? [["github"], ["html", { open: "never" }]] : "list",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    // Simula backend caído por defecto — los tests mockan lo que necesiten
    extraHTTPHeaders: {
      "x-test-env": "playwright",
    },
  },

  projects: [
    // --- Desktop ---
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    // --- Mobile (viewport principal de kame.col) ---
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "iphone-12",
      use: { ...devices["iPhone 12"] },
    },
  ],

  // Levanta Next.js automáticamente antes de correr los tests
  webServer: {
    command: "npm run start",
    cwd: "../frontend",
    url: BASE_URL,
    reuseExistingServer: !CI,
    timeout: 120_000,
    env: {
      PORT: "3000",
      // Mock backend URL para que Next.js no intente conectar a Django real
      NEXT_PUBLIC_BACKEND_URL: "http://localhost:3000",
    },
  },
});
