// The state fields useEditorField's tests read.
import { GardState, Transaction } from "wordgard/state";

export const bumpField = Transaction.Effect.define<string>();

// A counter changed by an effect only: typing leaves it as it was.
export const counter = GardState.Field.define<number>({
  create: () => 0,
  update: (value, tr) => value + tr.effects.filter((effect) => effect.is(bumpField)).length,
});

// Entries keyed by the effect's value, each a new object when bumped.
export const entries = GardState.Field.define<ReadonlyMap<string, { readonly n: number }>>({
  create: () => new Map(),
  update: (value, tr) => {
    let next: Map<string, { readonly n: number }> | null = null;
    for (const effect of tr.effects) {
      if (!effect.is(bumpField)) continue;
      next ??= new Map(value);
      next.set(effect.value, { n: (next.get(effect.value)?.n ?? 0) + 1 });
    }
    return next ?? value;
  },
});

// The document's length, recomputed on doc changes; the same number keeps its identity.
export const length = GardState.Field.Derived.define((state) => state.doc.length);
