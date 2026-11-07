# Releasing react-wordgard

Releases go out from `master`, in two steps around a release commit you make yourself.
`scripts/release.js` runs both.

## Before you start

- You're logged in to npm (`npm whoami`) with publish rights on `@stesura/react-wordgard`, and to
  GitHub (`gh auth status`).
- `master` has no uncommitted changes and matches `origin/master`.
- `CHANGELOG.md` starts with `## Unreleased`, listing the user-visible changes since the last
  release.
- Pick the version: on 0.x, a breaking change takes a minor version (0.3.0), and anything else a
  patch (0.2.3).

## 1. Prepare

```sh
npm run release:prepare -- <version>
```

This step:

- renames `## Unreleased` to `## <version> (<date>)` in the changelog;
- sets the version in `package.json` and `package-lock.json`;
- runs `npm run check` and `npm test` on React 18, which the lockfile pins;
- runs `npm run test:react19`, which installs React 19 without saving it, type-checks and tests,
  then reinstalls React 18.

It refuses a version that's already on npm.

Then commit (`Release <version>`) and push.

## 2. Publish

```sh
npm run release:publish
```

This step:

1. starts the `check` workflow on the pushed commit and waits for it. That workflow runs on React 18
   and 19 with the locked `wordgard`, and on React 18 with the newest `wordgard` in the peer range;
2. asks for confirmation, then runs `npm publish`. A published version can never be published
   again;
3. tags `v<version>`, pushes the tag and creates the GitHub release from the changelog section;
4. starts the `demo` workflow, which deploys the demo to GitHub Pages.

## If CI fails

Nothing is published or tagged. Fix the failure, commit and push, then run
`npm run release:publish` again. The version and changelog section are already set, so prepare
doesn't need to run again. If the fix changes what users see, edit that version's changelog
section before pushing.

To reproduce the React 19 job locally, run `npm run test:react19`. For the newest `wordgard` job,
run `npm i --no-save "wordgard@<peer range>"` and `npm test`, then `npm i` to go back to the
lockfile.

## If something fails after `npm publish`

The package is on npm, so don't publish again. Finish by hand what didn't run:

```sh
git tag v<version> && git push origin v<version>
gh release create v<version> --title <version> --notes "<changelog section>"
gh workflow run demo.yml --ref master
```
