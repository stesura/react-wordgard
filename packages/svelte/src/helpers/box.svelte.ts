// A value Svelte tracks as a whole, never proxied: Wordgard's objects (and the plain objects and
// arrays holding them) stay as they are.
export type Box<T> = { current: T };

export const box = <T>(initial: T): Box<T> => {
  let current = $state.raw(initial);
  return {
    get current() {
      return current;
    },
    set current(value: T) {
      current = value;
    },
  };
};
