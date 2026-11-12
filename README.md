# react-wordgard

React and Vue views for [Wordgard](https://www.wordgard.net): the framework draws the Wordgard
document in your app's tree, and any decoration that takes a shape, a wrapper or a widget can be a
component. Wordgard keeps doing the rest (input, selection, composition), and the API stays
Wordgard's.

| Package                                            | For                                               |
| -------------------------------------------------- | ------------------------------------------------- |
| [`@stesura/react-wordgard`](packages/react#readme) | React 18 and 19                                   |
| [`@stesura/vue-wordgard`](packages/vue#readme)     | Vue 3.5                                           |
| [`@stesura/wordgard-view`](packages/core#readme)   | Their shared core, which they bring: not for apps |

The three are released together, at one version. How they work:
[docs/how-it-works.md](docs/how-it-works.md). Developing them: [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

MIT, © 2026 Edoardo Caratti, see [LICENSE.txt](LICENSE.txt). Third-party notices:
[THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).
