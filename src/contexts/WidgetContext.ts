// The React widget a component is drawn in, as a handle that lasts as long as
// the component, so the context value never changes. Its position is read
// from the widget's tile when asked, not passed down at render.
import { createContext } from "react";

export type WidgetHandle = {
  readonly ref: (dom: Element | null) => void;
  readonly pos: () => number;
};

export const WidgetContext = createContext<WidgetHandle | null>(null);

// The root elements React widgets forwarded their ref to, for ReactDocTile to
// check it got the widget's DOM.
export const widgetRoots = new WeakSet<Element>();

export const createWidgetHandle = (): WidgetHandle => {
  let dom: Element | null = null;
  return {
    ref: (element) => {
      dom = element;
      if (element) widgetRoots.add(element);
    },
    pos: () => {
      // A removed element keeps its last tile.
      const tile = dom?.isConnected && dom.wgTile;
      if (!tile) throw new Error("This React widget isn't drawn");
      return tile.posBefore;
    },
  };
};
