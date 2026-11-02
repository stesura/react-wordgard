// A React shape's, wrapper's or mark's root, drawn for its component: the tag
// its Elt says, Wordgard's attributes and the root's ref, so the component
// can't get them wrong. The component's own props win, but `className` joins
// Wordgard's and `style` merges, its keys winning. Not in react-prosemirror.
import {
  type AllHTMLAttributes,
  type ReactNode,
  createElement,
  forwardRef,
  useContext,
  useMemo,
} from "react";

import { DecorationRootContext } from "../contexts/DecorationRootContext.js";
import { cssToStyle, htmlAttrsToReactProps } from "../helpers/props.js";
import { mergeRefs, toCallbackRef } from "../helpers/refs.js";

export type DecorationRootProps = AllHTMLAttributes<HTMLElement> & { children?: ReactNode };

export const DecorationRoot = forwardRef<Element, DecorationRootProps>(
  ({ className, style, ...props }, ref) => {
    const root = useContext(DecorationRootContext);
    const rootRef = root?.ref;
    const merged = useMemo(() => mergeRefs(rootRef, toCallbackRef(ref)), [rootRef, ref]);
    if (!root)
      throw new Error(
        "DecorationRoot is the root of a React shape, wrapper, mark or widget: use it in their component"
      );
    // Wordgard's style is a string, which React can't merge with an object.
    const { style: css, ...attrs } = root.attrs;
    const own = htmlAttrsToReactProps(style ? attrs : root.attrs);
    const classes = [own.className, className].filter(Boolean).join(" ");
    return createElement(root.tagName, {
      ...own,
      ...props,
      className: classes || undefined,
      ...(style && { style: { ...cssToStyle(css), ...style } }),
      ref: merged,
      suppressContentEditableWarning: true,
    });
  }
);

DecorationRoot.displayName = "DecorationRoot";
