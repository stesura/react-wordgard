// `v-focus`: focuses the element once mounted, as React's autoFocus.
import type { Directive } from "vue";

export const focus: Directive<HTMLElement> = { mounted: (element) => element.focus() };
