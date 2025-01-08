import { Node } from "@tiptap/core";
import { defaultMarkdownSerializer } from "prosemirror-markdown";


const Blockquote = Node.create({
    name: 'blockquote',
});

export default Blockquote.extend({
    /**
     * @return {{markdown: MarkdownNodeSpec}}
     */
    addStorage() {
        return {
            markdown: {
                serialize: defaultMarkdownSerializer.nodes.blockquote,
                parse: {
                    // handled by markdown-it
                },
            }
        }
    }
});
