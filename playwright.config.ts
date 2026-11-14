import { defineConfig, devices } from '@playwright/test';

const origin = `http://127.0.0.1:${process.env.GYMMIIE_TEST_PORT ?? 4173}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // Hydration and service-worker activation can be slow on loaded CI machines.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: origin,
    trace: 'retain-on-failure',
    serviceWorkers: 'allow',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'node scripts/test-server.mjs',
    url: origin,
    reuseExistingServer: false,
  },
});
