module.exports = {
  rootDir: ".",
  testRegex: ".*(\\.spec|\\.integration-spec)\\.ts$",
  transform: { "^.+\\.ts$": "ts-jest" },
  testEnvironment: "node",
};
