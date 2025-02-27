import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
  },
  testMatch: ["**/*.test.ts", "**/*.spec.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  collectCoverage: true,
  verbose: true,
  collectCoverageFrom: [
    "**/*.{js,jsx}",
    "!jest.config.js",
    "!**/node_modules/**",
    "!coverage/**",
    "!src/index.js",
    "!src/scraper.js",
  ],
  testEnvironment: "node",
};

export default config;
