## 0.4.2 (2026-11-20)

### Bug fixes

An editor drawn inside another editor's shape (a sub-editor in an atom's chrome) keeps the user's typing: the outer editor's shape no longer claims the inner editor's DOM changes, which left typed text doubled or threw.

## 0.4.1 (2026-11-19)

### Bug fixes

The published package no longer declares a source export condition pointing at files it doesn't ship.

## 0.4.0 (2026-11-19)

### New features

First release: the part of react-wordgard that doesn't depend on a framework, which react-wordgard and vue-wordgard share.

It isn't meant for apps: its API is what the views need, and changes with them.
