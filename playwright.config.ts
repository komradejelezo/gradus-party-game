import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "ui.spec.ts",
  fullyParallel: true,
  workers: 2,
  timeout: 45000,
  use: {
    baseURL: "http://localhost:4173/gradus-party-game/",
    viewport: { width: 1024, height: 768 },
    reducedMotion: "reduce",
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {},
  },
  webServer: {
    command: "npm run preview -- --port 4173",
    url: "http://localhost:4173/gradus-party-game/",
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
