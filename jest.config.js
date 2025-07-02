export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true
    }]
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  testMatch: [
    '**/tests/**/*.test.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleDirectories: ['node_modules', '<rootDir>/src']
};