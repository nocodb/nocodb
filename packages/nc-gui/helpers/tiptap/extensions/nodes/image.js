import { Node } from "@tiptap/core";
import { defaultMarkdownSerializer } from "prosemirror-markdown";


const Image = Node.create({
    name: 'image',
});

export default Image.extend({
    /**
     * @return {{markdown: MarkdownNodeSpec}}
     */
    addStorage() {
        return {
            markdown: {
                serialize: defaultMarkdownSerializer.nodes.image,
                parse: {
                    // handled by markdown-it
                },
            }
        }
    }
});
