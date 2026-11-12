// Adapted from react-wordgard's demo (demo/decorations/Mention.tsx) for Vue: a mention, an inline
// node drawn by a Vue widget, which shows a card for the person while it's selected (click it, or
// move onto it). The node's attributes fall through to its root.
import { computed, defineComponent } from "vue";

import { people } from "../../../demo/schema.js";
import { createWidgetType, useIsNodeSelected } from "../../src/index.js";

const MentionView = defineComponent({
  props: ["value"],
  setup(props: { value: string }) {
    const selected = useIsNodeSelected();
    const person = computed(() => people[props.value]);
    return { selected, person };
  },
  template: `
    <span class="mention">@{{ person?.name ?? value }}<span
        v-if="selected && person"
        class="mention-card"
        aria-hidden="true"
      ><strong>{{ person.name }}</strong><span>{{ person.role }}</span></span></span>`,
});

export const MentionWidget = createWidgetType<string>({ component: MentionView });
