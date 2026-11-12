// Not in react-wordgard, where flushSync commits every state change at once. Vue renders a
// component whose reactive state changed in a later job; the document's components that a flush
// changes (a NodeContent given new content, a component reading the editor's state or what a
// shape provides) must commit inside it, where Wordgard's DOM observer ignores mutations and the
// tiles are built. A tracked component's scheduler also records it as pending, per editor (its app
// context), and `flushUpdates` renders the pending ones at once, parents first, as Vue's own queue
// would; Vue's job then finds nothing to do. `effect.scheduler` and `instance.update` are
// internal, though typed: Vue has no public way to render now.
import {
  type AppContext,
  type ComponentInternalInstance,
  type ComponentOptions,
  getCurrentInstance,
  onBeforeMount,
} from "vue";

const pending = new WeakMap<AppContext, Set<ComponentInternalInstance>>();
const tracked = new WeakSet<ComponentInternalInstance>();

// Once its render effect exists, which is after setup.
const track = (instance: ComponentInternalInstance) => {
  if (tracked.has(instance)) return;
  tracked.add(instance);
  const { effect, appContext } = instance;
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

// Renders the pending components whose state changed, parents first, and
// says whether it rendered any.
export const flushUpdates = (context: AppContext) => {
  const set = pending.get(context);
  let rendered = false;
  while (set?.size) {
    let next: ComponentInternalInstance | null = null;
    for (const instance of set) if (!next || instance.uid < next.uid) next = instance;
    if (!next) break;
    set.delete(next);
    if (next.isUnmounted || !next.effect.dirty) continue;
    next.update();
    rendered = true;
  }
  return rendered;
};
