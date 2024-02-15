module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  coveragePathIgnorePatterns: [
    '/common',
    '/main.ts',
    '/prisma.service.ts',
    '/modules/auth/infra',
    '.*\\.config\\.ts$',
    '.*\\.module\\.ts$',
  ],
  testEnvironment: 'node',
};
