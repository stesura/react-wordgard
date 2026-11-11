// The DOM events useEditorEventListener can listen to. Wordgard fixes its handlers' event types at
// creation, and a handler makes its listener non-passive: scroll-blocking events (touch, wheel) and
// frequent ones (mousemove, pointer events) are left out.
import { Wordgard } from "wordgard/editor";
import { GardState } from "wordgard/state";

export const editorEvents = [
  "keydown",
  "keyup",
  "keypress",
  "beforeinput",
  "input",
  "mousedown",
  "mouseup",
  "mouseover",
  "mouseout",
  "click",
  "dblclick",
  "contextmenu",
  "focus",
  "blur",
  "copy",
  "cut",
  "paste",
  "dragstart",
  "dragend",
  "dragenter",
  "dragover",
  "dragleave",
  "drop",
  "compositionstart",
  "compositionupdate",
  "compositionend",
] as const;

export type EditorEvent = (typeof editorEvents)[number];

type Listener<Type extends EditorEvent> = (event: HTMLElementEventMap[Type]) => boolean | void;

type Listeners = { [Type in EditorEvent]: Listener<Type>[] };

// Every type's list made at once: the type checks none is missing, and they're
// then only read.
const createListeners = (): Listeners => ({
  keydown: [],
  keyup: [],
  keypress: [],
  beforeinput: [],
  input: [],
  mousedown: [],
  mouseup: [],
  mouseover: [],
  mouseout: [],
  click: [],
  dblclick: [],
  contextmenu: [],
  focus: [],
  blur: [],
  copy: [],
  cut: [],
  paste: [],
  dragstart: [],
  dragend: [],
  dragenter: [],
  dragover: [],
  dragleave: [],
  drop: [],
  compositionstart: [],
  compositionupdate: [],
  compositionend: [],
});

const registries = new WeakMap<Wordgard, Listeners>();

export const listenersOf = <Type extends EditorEvent>(wg: Wordgard, type: Type) => {
  let registry = registries.get(wg);
  if (!registry) {
    registry = createListeners();
    registries.set(wg, registry);
  }
  return registry[type];
};

const handler = <Type extends EditorEvent>(type: Type) =>
  Wordgard.domEventHandler(type, (event, wg) => {
    // A copy: a listener may unregister one.
    for (const listener of [...listenersOf(wg, type)])
      if (listener(event) || event.defaultPrevented) return true;
    return false;
  });

// Whether a state has the handlers: `GardState.reconfigure` drops them.
const installed = GardState.Facet.define<boolean, boolean>({
  combine: (values) => values.length > 0,
});

export const hasEditorEventHandlers = (state: GardState) => state.facet(installed.reader);

export const editorEventHandlers = GardState.prec.highest([
  editorEvents.map(handler),
  installed.of(true),
]);
