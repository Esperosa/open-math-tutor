import { defineConfig } from '@playwright/test';
const port = process.env.PLAYWRIGHT_PORT ?? '5174';
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './tests', testMatch: '**/pwa.spec.ts', workers: 1, timeout: 45000,
  use: { baseURL, headless: true, viewport: { width: 1280, height: 900 }, trace: 'retain-on-failure' },
  webServer: { command: `npm run preview -- --port ${port}`, url: baseURL, reuseExistingServer: false, timeout: 60000 },
});
