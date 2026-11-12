// Adapted from react-wordgard's helpers/props.ts for Vue: Wordgard's attributes as Vue props.
// Vue sets some props as DOM properties (`src`, `width`, `hidden`); a `^` before the name makes it
// set the attribute, as Wordgard's own setAttribute does.
import { Comment, Fragment, Text, type VNode, cloneVNode, isVNode } from "vue";
import type { Attributes } from "wordgard/doc";

export const eltProps = (attrs: Attributes) => {
  const props: Record<string, string> = {};
  for (let i = 0; i + 1 < attrs.length; i += 2) {
    const name = attrs[i];
    const value = attrs[i + 1];
    if (name !== undefined && value !== undefined) props[`^${name}`] = value;
  }
  return props;
};

// For a decoration's component (or a wrapped node's root), whose root they
// fall through to: by their names, so Vue merges them with the root's own as
// it merges any fallthrough attributes (`class` joined, `style` merged,
// Wordgard's winning otherwise). A `^` name would be another key, set in
// whichever order the two last changed.
export const decorationProps = (attrs: readonly string[]) => {
  const props: Record<string, string> = {};
  for (let i = 0; i + 1 < attrs.length; i += 2) {
    const name = attrs[i];
    const value = attrs[i + 1];
    if (name !== undefined && value !== undefined) props[name] = value;
  }
  return props;
};

// A slot's vnodes as an element's own children, without what would leave
// anchors in it: a fragment's (a `v-for`, a `<template v-if>`) are flattened,
// a `v-if`'s comment and empty text dropped. A fragment's children are keyed
// within it, as `v-if` keys its branches 0, 1…: theirs are scoped by the
// fragment's place, which `v-if`'s comment keeps when the branch is gone.
export const withoutAnchors = (vnodes: readonly VNode[], scope = ""): VNode[] =>
  vnodes.flatMap((vnode, i) => {
    if (vnode.type == Comment) return [];
    if (vnode.type == Text && !vnode.children) return [];
    if (vnode.type == Fragment && Array.isArray(vnode.children))
      return withoutAnchors(vnode.children.filter(isVNode), `${scope}${String(vnode.key ?? i)}.`);
    if (!scope) return [vnode];
    return [cloneVNode(vnode, { key: `${scope}${String(vnode.key ?? `#${i}`)}` })];
  });
