// Not in react-prosemirror. React uses the server snapshot on the server and while hydrating, then
// re-renders with the client's: no effect, and a client-only render sees `true` at once.
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * Whether the component draws in the browser, past hydration: `false` on the server and in the
 * hydration pass, `true` after it and in a page rendered on the client only. For a host that reads
 * the browser (`window`, `localStorage`) in render, above `WordgardEditor`.
 */
export const useHydrated = () => useSyncExternalStore(subscribe, onClient, onServer);
