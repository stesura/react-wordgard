## 0.4.5 (2026-11-23)

### Bug fixes

A node wrapper's NodeRootProps (class, style, attributes) survive the user typing inside the node: restoring the DOM after native input no longer resets them to the shape's.

## 0.4.4 (2026-11-21)

### Bug fixes

A widget leaving the start of a block, in the update where that block's own decorations change (a point attribute on it), is no longer drawn twice: the block kept its last layout, the widget included. Seen as a collaborator's caret left behind at the start of the paragraph being typed in.

## 0.4.3 (2026-11-20)

### New features

`batch(wg, change)` runs a change and commits what the editor's components draw from it through its renderer before returning; react-wordgard and vue-wordgard re-export it.

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
