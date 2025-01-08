import { Node } from "@tiptap/core";
import { escapeHTML } from "../../util/dom";


const Text = Node.create({
    name: 'text',
});

export default Text.extend({
    /**
     * @return {{markdown: MarkdownNodeSpec}}
     */
    addStorage() {
        return {
            markdown: {
                serialize(state, node) {
                    state.text(escapeHTML(node.text));
                },
                parse: {
                    // handled by markdown-it
                },
            }
        }
    }
});
