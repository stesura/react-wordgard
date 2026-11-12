import { Wordgard } from "wordgard/editor";
import { basicSchema } from "wordgard/schema";
import { GardState } from "wordgard/state";

describe("wordgard", () => {
  it("resolves and creates a GardState", () => {
    const state = GardState.create({ config: [basicSchema()] });

    expect(state).toBeInstanceOf(GardState);
    expect(state.doc.schema).toBe(state.schema);
    expect(typeof Wordgard).toBe("function");
  });
});
