// The DOM events useEditorEventListener can listen to, and the handlers
// ReactWordgard installs for them. Wordgard has a handler per event type, so
// the types are fixed when the editor is created. Adding a handler makes
// Wordgard's listener for the type non-passive: the events that block
// scrolling (touch, wheel) aren't among them, nor the most frequent ones
// (mousemove, pointer events), each of which would then walk the tiles.
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

export const hasEditorEventHandlers = (state: GardState) => state.facet(installed);

// Wordgard redoes its handlers only when its plugins change: this one makes
// adding or dropping the handlers such a change.
const refresh = Wordgard.Plugin.define(() => ({}));

export const editorEventHandlers = GardState.prec.highest([
  editorEvents.map(handler),
  installed.of(true),
  refresh,
]);
