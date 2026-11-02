import { type ForwardedRef, type RefCallback, version } from "react";

type DOMRef = (dom: Element | null) => void;

// A React decoration's root ref, with what else must know its root: the
// React wrapper around it, its hooks' handlers.
export const mergeRefs =
  (...refs: (DOMRef | undefined)[]): DOMRef =>
  (dom) => {
    for (const ref of refs) ref?.(dom);
  };

// A forwarded ref as a callback, for mergeRefs.
export const toCallbackRef = <T>(ref: ForwardedRef<T>): RefCallback<T> | undefined =>
  typeof ref == "function"
    ? ref
    : ref
      ? (value) => {
          ref.current = value;
        }
      : undefined;

// Whether React gives `component` a ref: React 19 passes it as a prop, React
// 18 only to a forwardRef (an object) and warns for a function component,
// which needs none with DecorationRoot.
const refAsProp = Number(version.split(".")[0]) >= 19;

export const takesRef = (component: unknown) => refAsProp || typeof component != "function";
