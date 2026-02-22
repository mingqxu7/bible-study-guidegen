import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test files pattern
    include: ['tests/**/*.test.js'],
    
    // Timeout per test (10 seconds)
    testTimeout: 10000,
    
    // Reporter
    reporters: ['verbose'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      include: ['services/**', 'middleware/**'],
      reporter: ['text', 'text-summary'],
    },
  },
});
