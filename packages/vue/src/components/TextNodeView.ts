// Adapted from react-wordgard's TextNodeView for Vue: a bare text node, keyed. A function, not a
// component: a component's vnode adds nothing here.
import { Text, createVNode } from "vue";

export const TextNodeView = (key: string, text: string) => createVNode(Text, { key }, text);
