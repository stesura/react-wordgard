// Adapted from react-wordgard's WordgardEditor for Vue. The spec is read once: Wordgard's editor
// owns its state. As react-wordgard's, it creates no editor on the server nor while the page
// hydrates (Wordgard needs the DOM); in a page drawn in the browser only, it creates it at once.
import {
  defineComponent,
  getCurrentInstance,
  h,
  inject,
  onMounted,
  provide,
  shallowRef,
  ssrContextKey,
} from "vue";
import type { Wordgard } from "wordgard/editor";

import { editorOf } from "@stesura/wordgard-view";
import { VueWordgard } from "../VueWordgard.js";
import { EditorKey } from "../contexts/EditorContext.js";

type Spec = Omit<Wordgard.Spec, "parent">;

const props: (keyof Spec)[] = ["doc", "config", "selection", "state", "scrollTo"];

const Host = defineComponent(
  ({ doc, config, selection, state, scrollTo }: Spec, { slots }) => {
    provide(EditorKey, editorOf(VueWordgard.host({ doc, config, selection, state, scrollTo })));
    return () => slots.default?.();
  },
  { props }
);

/**
 * Creates a Wordgard editor from the spec (`doc`, `config`, `selection`, `state`, `scrollTo`) and
 * provides it to the components in its slot. It draws no element of its own. The spec is read
 * once, when the editor is created: from then on the editor owns its state. On the server and
 * while the page hydrates it creates no editor and draws nothing: its slot appears once the page
 * has mounted.
 */
export const WordgardEditor = defineComponent(
  (spec: Spec, { slots }) => {
    // The server's render provides its context; a component being hydrated has its vnode bound to
    // the server's DOM before its setup runs.
    const server = inject(ssrContextKey, null) != null;
    const hydrating = getCurrentInstance()?.vnode.el != null;
    const ready = shallowRef(!server && !hydrating);
    if (!ready.value)
      onMounted(() => {
        ready.value = true;
      });
    return () => (ready.value ? h(Host, spec, slots) : null);
  },
  { props }
);
