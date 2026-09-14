import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/lib/mahjong/**/*.ts'],
      exclude: [
        'src/lib/mahjong/index.ts',
        '**/*.d.ts',
        '**/types/**',
      ],
    },
  },
});
