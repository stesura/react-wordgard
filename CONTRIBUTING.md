<!-- Copyright (c) The New York Times Company -->

## Project setup

This project is written in Typescript. It uses:

- [npm](https://docs.npmjs.com/) for package management
- [swc](https://swc.rs/docs/) to compile Typescript to Javascript,
- [tsc](https://www.typescriptlang.org/docs/handbook/compiler-options.html) to
  check type correctness and generate type declaration (`.d.ts`) files,
- [prettier](https://prettier.io/docs/en/index.html) for auto-formatting
- [eslint](https://eslint.org/docs/latest/) for static code analysis

We use
[conditional exports](https://nodejs.org/api/packages.html#conditional-exports)
to provide both ESM and CJS builds of the library, in addition to type
declarations.

All of the source code lives in `src/`.

## Local development

You must have Node.js v16.9 or higher installed on your development machine.

Run `npm install` to install dependencies locally.

You can check type correctness, eslint validation, and formatting with
`npm run check`. You can auto-fix all automatically fixable issues with
`npm run fix`. And you can build output files with `npm run build`.

You can run tests with `npm test`. If you want to run the unit tests in "watch"
mode, use `npm run test:unit -- --watch`. See the
[Jest CLI docs](https://jestjs.io/docs/cli) for more information.
