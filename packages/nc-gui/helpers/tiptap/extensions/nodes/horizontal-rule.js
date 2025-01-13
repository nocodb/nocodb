import { Node } from "@tiptap/core";
import { defaultMarkdownSerializer } from "prosemirror-markdown";


const HorizontalRule = Node.create({
    name: 'horizontalRule',
});

export default HorizontalRule.extend({
    /**
     * @return {{markdown: MarkdownNodeSpec}}
     */
    addStorage() {
        return {
            markdown: {
                serialize: defaultMarkdownSerializer.nodes.horizontal_rule,
                parse: {
                    // handled by markdown-it
                },
            }
        }
    }
});
