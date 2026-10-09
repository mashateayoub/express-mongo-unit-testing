module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
  clearMocks: true,
  restoreMocks: true,
  resetModules: false,
  collectCoverageFrom: ['src/**/*.js'],
  coverageReporters: ['text', 'html', 'lcov'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: { statements: 90, branches: 85, functions: 90, lines: 90 }
  }
};
