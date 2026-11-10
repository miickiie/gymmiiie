import { defineConfig } from 'vitest/config';

export default defineConfig({
  envDir: false,
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'scripts/**/*.test.ts',
      'worker/**/*.test.ts',
    ],
    restoreMocks: true,
    clearMocks: true,
  },
});
