import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-only-secret-not-for-production',
      JWT_EXPIRES_IN: '1h',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/ecotrace_test',
    },
  },
});
