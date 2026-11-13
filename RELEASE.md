# Releasing react-wordgard, vue-wordgard and svelte-wordgard

The four packages (`@stesura/wordgard-view`, `@stesura/react-wordgard`, `@stesura/vue-wordgard`,
`@stesura/svelte-wordgard`) are released together, at one version: the views pin the core exactly. Releases go out from
`master`, in two steps around a release commit you make yourself. `scripts/release.js` runs both.

## Before you start

- You're logged in to npm (`npm whoami`) with publish rights on the four packages, and to GitHub
  (`gh auth status`).
- `master` has no uncommitted changes and matches `origin/master`.
- Each package's `CHANGELOG.md` with changes starts with `## Unreleased`, listing the user-visible
  changes since the last release. A package without one gets a section saying it has no changes of
  its own.
- Pick the version: on 0.x, a breaking change takes a minor version (0.3.0), and anything else a
  patch (0.2.3).

## 1. Prepare

```sh
npm run release:prepare -- <version>
```

This step:

- renames `## Unreleased` to `## <version> (<date>)` in each package's changelog;
- sets the version of the four packages, and the views' dependency on the core, in their
  `package.json` and `package-lock.json`;
- runs `npm run check` and `npm test` on React 18, which the lockfile pins;
- runs `npm run test:react19`, which installs React 19 without saving it, type-checks and tests,
  then reinstalls React 18;
- runs `npm run test:svelte-hmr`, which edits the Svelte demo's components on its dev server.

It refuses a version any of the four already has on npm.

Then commit (`Release <version>`) and push.

## 2. Publish

```sh
npm run release:publish
```

This step:

1. starts the `check` workflow on the pushed commit and waits for it. That workflow runs on React 18
   and 19 with the pinned `wordgard`, Svelte in its three builds, and Svelte's HMR;
2. asks for confirmation, then publishes the four packages, the core first (`npm publish` in each
   workspace, which builds it first). A published version can never be published again;
3. tags `v<version>`, pushes the tag and creates the GitHub release from the four changelog
   sections;
4. starts the `demo` workflow, which deploys the demos to GitHub Pages (Vue's under `/vue/`,
   Svelte's under `/svelte/`).

## If CI fails

Nothing is published or tagged. Fix the failure, commit and push, then run
`npm run release:publish` again. The version and changelog section are already set, so prepare
doesn't need to run again. If the fix changes what users see, edit that version's changelog
sections before pushing.

To reproduce the React 19 job locally, run `npm run test:react19`.

## If something fails after `npm publish`

What's on npm stays there: publish by hand only the packages that are missing
(`npm publish -w <name>`), then finish what didn't run:

```sh
git tag v<version> && git push origin v<version>
gh release create v<version> --title <version> --notes "<changelog section>"
gh workflow run demo.yml --ref master
```
