import { defineConfig } from '@playwright/test';
// Never reuse the user's dev server: it may serve another worktree's code.
const port = process.env.PLAYWRIGHT_PORT ?? '5320';
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './tests', testIgnore: '**/pwa.spec.ts', fullyParallel: false, workers: 1, timeout: 45000,
  use: { baseURL, headless: true, viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', locale: 'cs-CZ' },
  webServer: { command: `npm run dev -- --port ${port}`, url: baseURL, reuseExistingServer: false, timeout: 60000 },
});
