/* Copyright (c) The New York Times Company */

module.exports = {
  displayName: "react-wordgard",
  rootDir: "src",
  testEnvironment: "jsdom",
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  testPathIgnorePatterns: ["src/components/__tests__/ProseMirror.*.test.tsx"],
  moduleNameMapper: {
    "(.+)\\.js": "$1",
  },
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest"],
  },
  // wordgard ships ESM only.
  transformIgnorePatterns: ["/node_modules/(?!wordgard/)"],
};
