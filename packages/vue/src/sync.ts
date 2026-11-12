// Not in react-wordgard, where flushSync commits every state change at once. Vue renders a
// component whose reactive state changed in a later job; the document's components that a flush
// changes (a NodeContent given new content, a component reading the editor's state or what a
// shape provides) must commit inside it, where Wordgard's DOM observer ignores mutations and the
// tiles are built. A tracked component's scheduler also records it as pending, per document (its
// app context), and `flushUpdates` renders the pending ones at once, parents first, as Vue's own queue
// would; Vue's job then finds nothing to do. `effect.scheduler` and `instance.update` are
// internal, though typed: Vue has no public way to render now.
import {
  type AppContext,
  type ComponentInternalInstance,
  type ComponentOptions,
  getCurrentInstance,
  onBeforeMount,
  onUnmounted,
} from "vue";

import type { EditorValue } from "@stesura/wordgard-view";

const pending = new WeakMap<AppContext, Set<ComponentInternalInstance>>();
const tracked = new WeakSet<ComponentInternalInstance>();
// The documents' app contexts. A component outside them (a toolbar reading the
// editor's state) renders when Vue schedules it, in the same tick.
const documents = new WeakSet<AppContext>();

export const syncContext = (context: AppContext) => {
  documents.add(context);
};

/**
 * What the calling component runs when the editor publishes a state: `update` at once in the
 * document, where it commits inside the flush; elsewhere once the flush is done. The commit's
 * render() runs Vue's pending callbacks: a watcher outside the document would run mid-flush, where
 * a dispatch throws.
 */
export const onPublish = ({ afterFlush, cancel }: EditorValue, update: () => void) => {
  const instance = getCurrentInstance();
  if (instance && documents.has(instance.appContext)) return update;
  onUnmounted(() => cancel(update));
  return () => afterFlush(update);
};

// Once its render effect exists, which is after setup.
const track = (instance: ComponentInternalInstance) => {
  if (tracked.has(instance)) return;
  tracked.add(instance);
  const { effect, appContext } = instance;
  if (!documents.has(appContext)) return;
  const queue = effect.scheduler;
  effect.scheduler = () => {
    let set = pending.get(appContext);
    if (!set) pending.set(appContext, (set = new Set()));
    set.add(instance);
    queue?.();
  };
};

/** Has the calling component commit inside the editor's flush when its reactive state changed. */
export const updateInFlush = () => {
  const instance = getCurrentInstance();
  if (!instance) throw new Error("updateInFlush is called outside a component's setup");
  onBeforeMount(() => track(instance));
};

// For the document's app context: every component in it, the app's own
// decorations' included, commits inside the flush. Mixins don't reach
// functional components, nor any component without the Options API (a build
// flag): those commit after the flush, which the doc tile takes as it takes a
// component's own update.
export const syncMixin: ComponentOptions = {
  beforeMount: () => {
    const instance = getCurrentInstance();
    if (instance) track(instance);
  },
};

// Renders the pending components whose state changed, parents first (by uid,
// as Vue's queue: a parent is created before its children), and says whether
// it rendered any. A child its parent rendered is no longer dirty, nor is one
// unmounted earlier in the loop (its effect stopped; Vue sets `isUnmounted`
// after its patch). Those a render records join the queue in their place.
export const flushUpdates = (context: AppContext) => {
  const set = pending.get(context);
  if (!set?.size) return false;
  const queue = [...set].sort((a, b) => a.uid - b.uid);
  set.clear();
  let rendered = false;
  for (let at = 0; at < queue.length; at++) {
    const next = queue[at];
    if (!next || next.isUnmounted || !next.effect.dirty) continue;
    next.update();
    rendered = true;
    for (const added of set) insert(queue, added, at + 1);
    set.clear();
  }
  return rendered;
};

const insert = (
  queue: ComponentInternalInstance[],
  instance: ComponentInternalInstance,
  from: number
) => {
  let low = from;
  let high = queue.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if ((queue[mid]?.uid ?? 0) < instance.uid) low = mid + 1;
    else high = mid;
  }
  queue.splice(low, 0, instance);
};
