import { ENTITY_URI_PREFIX, parseEntityRef } from "@cocurdex/shared";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { openEntity } from "@/lib/entity-events";

export const EntityLinkClick = Extension.create({
  name: "entityLinkClick",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("entityLinkClick"),
        props: {
          handleClick: (_view, _pos, event) => {
            const target = event.target;
            if (!(target instanceof Element)) return false;
            const href = target.closest("a")?.getAttribute("href") ?? "";
            if (!href.startsWith(ENTITY_URI_PREFIX)) return false;
            event.preventDefault();
            const ref = parseEntityRef(href);
            if (ref) openEntity(ref);
            return true;
          },
        },
      }),
    ];
  },
});
