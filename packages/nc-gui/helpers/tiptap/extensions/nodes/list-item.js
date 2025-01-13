import { Node } from "@tiptap/core";
import { defaultMarkdownSerializer } from "prosemirror-markdown";


const ListItem = Node.create({
    name: 'listItem',
});

export default ListItem.extend({
    /**
     * @return {{markdown: MarkdownNodeSpec}}
     */
    addStorage() {
        return {
            markdown: {
                serialize: defaultMarkdownSerializer.nodes.list_item,
                parse: {
                    // handled by markdown-it
                },
            }
        }
    }
});
