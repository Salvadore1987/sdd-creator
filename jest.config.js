/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  preset: 'ts-jest',
  testTimeout: 30000,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/cli.ts',
    '!src/index.ts',
    '!src/types/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75,
    },
    './src/domain/': {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/adapters/': {
      branches: 55,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
    },
    {
      displayName: 'e2e',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.ts'],
    },
  ],
};
