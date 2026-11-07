// Adapted from react-prosemirror, for Wordgard: `draggable`, `hidden`,
// `colspan` and `rowspan` render as Wordgard's own setAttribute does (shape
// attributes, such as an image's `draggable="false"`, go through here).
// mergeReactProps is left out: nothing uses it.

import { type CSSProperties, HTMLProps } from "react";

let patched = false;

const patchConsoleError = () => {
  if (patched) return;

  const consoleError = console.error;
  console.error = (...data: unknown[]) => {
    const [message, prop, correction] = data;
    if (
      typeof message === "string" &&
      message.includes("Invalid DOM property `%s`. Did you mean `%s`?") &&
      prop === "STYLE" &&
      correction === "style"
    ) {
      return;
    }
    consoleError(...data);
  };
  patched = true;
};

// SVG attributes React takes camelCased, `stroke-width` as `strokeWidth`. Other
// hyphenated names, which React passes through, keep theirs.
const svgHyphenated = new Set(
  (
    "accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule " +
    "color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline " +
    "enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size " +
    "font-size-adjust font-stretch font-style font-variant font-weight glyph-name " +
    "glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x " +
    "image-rendering letter-spacing lighting-color marker-end marker-mid marker-start " +
    "overline-position overline-thickness paint-order pointer-events rendering-intent " +
    "shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness " +
    "stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit " +
    "stroke-opacity stroke-width text-anchor text-decoration text-rendering transform-origin " +
    "underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic " +
    "v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y " +
    "word-spacing writing-mode x-height"
  ).split(" ")
);

/**
 * Given a record of HTML attributes, returns tho
 * equivalent React props. `foreign`: an SVG or MathML element's, whose
 * `stroke-width` and `xlink:href` React takes as `strokeWidth` and `xlinkHref`.
 */
export const htmlAttrsToReactProps = (
  attrs: Record<string, string>,
  foreign = false
): HTMLProps<HTMLElement> => {
  patchConsoleError();
  const props: Record<string, unknown> = {};
  for (const [attrName, attrValue] of Object.entries(attrs)) {
    switch (attrName.toLowerCase()) {
      case "class": {
        props.className = attrValue;
        break;
      }
      case "style": {
        // HACK: React expects the `style` prop to be an
        // object mapping from CSS property name to value.
        // However, it will pass un-recognized props through
        // to the underlying DOM element, and HTML attributes
        // are case insensitive. So we use `STYLE` instead,
        // which React doesn't intercept, but the DOM treats
        // as `style`. Not on SVG or MathML, whose attribute
        // names keep their case: those get the object.
        if (foreign) props.style = cssToStyle(attrValue);
        else props.STYLE = attrValue;
        break;
      }
      case "autocapitalize": {
        props.autoCapitalize = attrValue;
        break;
      }
      case "contenteditable": {
        if (attrValue === "" || attrValue === "true") {
          props.contentEditable = true;
          break;
        }
        if (attrValue === "false") {
          props.contentEditable = false;
          break;
        }
        if (attrValue === "plaintext-only") {
          props.contentEditable = "plaintext-only";
          break;
        }
        props.contentEditable = null;
        break;
      }
      case "draggable": {
        props.draggable = attrValue !== "false";
        break;
      }
      case "enterkeyhint": {
        props.enterKeyHint = attrValue;
        break;
      }
      case "for": {
        props.htmlFor = attrValue;
        break;
      }
      case "hidden": {
        props.hidden = true;
        break;
      }
      case "inputmode": {
        props.inputMode = attrValue;
        break;
      }
      case "itemprop": {
        props.itemProp = attrValue;
        break;
      }
      case "spellcheck": {
        if (attrValue === "" || attrValue === "true") {
          props.spellCheck = true;
          break;
        }
        if (attrValue === "false") {
          props.spellCheck = false;
          break;
        }
        props.spellCheck = null;
        break;
      }
      case "colspan":
      case "rowspan": {
        const numValue = parseInt(attrValue, 10);
        if (!Number.isNaN(numValue)) {
          props[attrName.toLowerCase() == "colspan" ? "colSpan" : "rowSpan"] = numValue;
        }
        break;
      }
      case "tabindex": {
        const numValue = parseInt(attrValue, 10);
        if (!Number.isNaN(numValue)) {
          props.tabIndex = numValue;
        }
        break;
      }
      case "autocomplete": {
        props.autoComplete = attrValue;
        break;
      }
      case "autofocus": {
        props.autoFocus = attrValue != null;
        break;
      }
      case "formaction": {
        props.formAction = attrValue;
        break;
      }
      case "formenctype": {
        props.formEnctype = attrValue;
        break;
      }
      case "formmethod": {
        props.formMethod = attrValue;
        break;
      }
      case "formnovalidate": {
        props.formNoValidate = attrValue;
        break;
      }
      case "formtarget": {
        props.formTarget = attrValue;
        break;
      }
      case "maxlength": {
        const numValue = parseInt(attrValue, 10);
        if (!Number.isNaN(numValue)) {
          props.maxLength = attrValue;
        }
        break;
      }
      case "minlength": {
        const numValue = parseInt(attrValue, 10);
        if (!Number.isNaN(numValue)) {
          props.minLength = attrValue;
        }
        break;
      }
      case "max": {
        const numValue = parseInt(attrValue, 10);
        if (!Number.isNaN(numValue)) {
          props.max = attrValue;
        }
        break;
      }
      case "min": {
        const numValue = parseInt(attrValue, 10);
        if (!Number.isNaN(numValue)) {
          props.min = attrValue;
        }
        break;
      }
      case "multiple": {
        props.multiple = attrValue != null;
        break;
      }
      case "readonly": {
        props.readOnly = attrValue != null;
        break;
      }
      case "required": {
        props.required = attrValue != null;
        break;
      }
      case "size": {
        const numValue = parseInt(attrValue, 10);
        if (!Number.isNaN(numValue)) {
          props.size = attrValue;
        }
        break;
      }
      case "step": {
        if (attrValue === "any") {
          props.step = attrValue;
          break;
        }
        const numValue = parseInt(attrValue, 10);
        if (!Number.isNaN(numValue) && numValue > 0) {
          props.step = attrValue;
        }
        break;
      }
      case "disabled": {
        props.disabled = attrValue != null;
        break;
      }
      case "rows": {
        const numValue = parseInt(attrValue, 10);
        if (!Number.isNaN(numValue)) {
          props.rows = attrValue;
        }
        break;
      }
      default: {
        const name =
          foreign && (svgHyphenated.has(attrName) || /^(xlink|xml|xmlns):/.test(attrName))
            ? attrName.replace(/[-:]([a-z])/g, (_, char: string) => char.toUpperCase())
            : attrName;
        props[name] = attrValue;
        break;
      }
    }
  }
  return props;
};

const namespaced = /^(svg|math):/;

// An Elt's tag as React takes it: Wordgard's `svg:path` is React's `path`. React
// gives <svg> and <math> their namespace, and what's inside them inherits it.
export const reactTagName = (tagName: string) => tagName.replace(namespaced, "");

// An Elt's attributes as React props.
export const eltProps = (tagName: string, attrs: Record<string, string>) =>
  htmlAttrsToReactProps(attrs, namespaced.test(tagName));

// A style attribute as React's style object, for merging with a component's:
// `background-color` as `backgroundColor`, custom properties as they are.
export const cssToStyle = (css: string | undefined): CSSProperties => {
  const style: Record<string, string> = {};
  for (const declaration of css?.split(";") ?? []) {
    const colon = declaration.indexOf(":");
    if (colon < 0) continue;
    const name = declaration.slice(0, colon).trim();
    const value = declaration.slice(colon + 1).trim();
    if (!name || !value) continue;
    const key = name.startsWith("--")
      ? name
      : name.replace(/^-ms-/, "ms-").replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
    style[key] = value;
  }
  return style;
};

// Not in react-prosemirror: the props a React decoration's component gets for
// a root it draws by hand, Wordgard's style as an object it can merge with its
// own (`STYLE`, a string, would overwrite its `style` when Wordgard's changes).
export const componentProps = (attrs: Record<string, string>): HTMLProps<HTMLElement> => {
  const { style, ...rest } = attrs;
  const props = htmlAttrsToReactProps(rest);
  return style ? { ...props, style: cssToStyle(style) } : props;
};
