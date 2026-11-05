// The React decoration a component is drawn in, for the decoration hooks. Replaces
// react-prosemirror's GetPosContext, SelectNodeContext, StopEventContext and IgnoreMutationContext.
import { createContext, useContext } from "react";

export type DecorationHandlers = {
  readonly getPos: () => number;
  readonly stopEvent: Set<(event: Event) => boolean>;
  readonly ignoreMutation: Set<(record: MutationRecord) => boolean>;
};

export type DecorationContextValue = {
  readonly handlers: DecorationHandlers;
  readonly selected: boolean;
};

export const DecorationContext = createContext<DecorationContextValue | null>(null);

export const useDecorationContext = (hook: string) => {
  const context = useContext(DecorationContext);
  if (!context) throw new Error(`${hook} is called outside a React shape, wrapper, mark or widget`);
  return context;
};

export const createDecorationHandlers = (getPos: () => number): DecorationHandlers => ({
  getPos,
  stopEvent: new Set(),
  ignoreMutation: new Set(),
});

// The handlers of the decorations whose root elements they are.
const roots = new WeakMap<Element, DecorationHandlers>();

export const decorationRoot = (handlers: DecorationHandlers) => (dom: Element | null) => {
  if (dom) roots.set(dom, handlers);
};

// Whether a decoration around `node`, innermost first, says yes. Only in
// `node`'s own editor: one nested in a decoration isn't its.
const someAround = (node: Node | null, says: (handlers: DecorationHandlers) => boolean) => {
  for (let cur = node; cur && !cur.wgTile?.isDoc; cur = cur.parentNode) {
    const handlers = cur instanceof Element ? roots.get(cur) : undefined;
    if (handlers && says(handlers)) return true;
  }
  return false;
};

// Whether a decoration around the event's target stops it (useStopEvent).
export const stopsEvent = (event: Event) =>
  someAround(event.target instanceof Node ? event.target : null, ({ stopEvent }) =>
    [...stopEvent].some((stop) => stop(event))
  );

// Whether a decoration around the record's target claims it (useIgnoreMutation).
export const ignoresMutation = (record: MutationRecord) =>
  someAround(record.target, ({ ignoreMutation }) =>
    [...ignoreMutation].some((ignore) => ignore(record))
  );
