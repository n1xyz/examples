/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
  },
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\.{1,2}/.*)\.js$": "$1",
    "^@n1xyz/nts-sdk$": "<rootDir>/node_modules/@n1xyz/nts-sdk",
  },
};