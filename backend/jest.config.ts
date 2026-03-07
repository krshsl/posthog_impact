import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          module: "commonjs",
          moduleResolution: "node",
        },
      },
    ],
  },
  testMatch: ["**/__tests__/**/*.test.ts"],
  coverageDirectory: "coverage",
  collectCoverageFrom: ["lib/**/*.ts", "app/api/**/*.ts"],
};

export default config;
