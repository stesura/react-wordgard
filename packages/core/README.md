# @stesura/wordgard-view

The core of [react-wordgard](https://www.npmjs.com/package/@stesura/react-wordgard) and
[vue-wordgard](https://www.npmjs.com/package/@stesura/vue-wordgard): the part of their view over
[Wordgard](https://www.wordgard.net) that doesn't depend on a framework. It lays out the document,
builds Wordgard's tiles over the DOM a framework draws, and registers the decorations components
draw.

**Not for apps.** Install react-wordgard or vue-wordgard, which bring it at their own version. Its
API is what the views need and changes with them; they're released together.

How it works: [docs/how-it-works.md](https://github.com/stesura/react-wordgard/blob/master/docs/how-it-works.md).

## Licence

MIT, © 2026 Edoardo Caratti, see [LICENSE.txt](LICENSE.txt).

Includes code from react-prosemirror (© Handle with Care Collective and The New York Times
Company) and Wordgard (© Marijn Haverbeke); their notices are in
[THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).
