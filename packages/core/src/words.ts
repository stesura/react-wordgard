// Not in react-prosemirror: how the core's errors name the framework drawing the document and
// what they advise, given by each renderer, so a Vue user doesn't read React's advice.
export type Words = {
  // The library: "react-wordgard".
  readonly library: string;
  // The framework: "React".
  readonly name: string;
  // What a decoration's component does to give the view its root.
  readonly root: string;
  // What a widget's component does to give the view its root.
  readonly widgetRoot: string;
  // What marks a shape's content element: "contentDOMRef".
  readonly content: string;
  // What a wrapper's component draws for what it wraps: "its children".
  readonly wrapped: string;
  // How to keep an anchor (an empty text node or a comment) out of a content element.
  readonly anchor: string;
};
