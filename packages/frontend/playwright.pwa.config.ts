import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '**/pwa.spec.ts', workers: 1, timeout: 45000,
  use: { baseURL: 'http://localhost:5174', headless: true, viewport: { width: 1280, height: 900 }, trace: 'retain-on-failure' },
  webServer: { command: 'npm run preview -- --port 5174', url: 'http://localhost:5174', reuseExistingServer: false, timeout: 60000 },
});
