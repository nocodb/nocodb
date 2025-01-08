import { Node } from "@tiptap/core";


const BulletList = Node.create({
    name: 'bulletList',
});

export default BulletList.extend({
    /**
     * @return {{markdown: MarkdownNodeSpec}}
     */
    addStorage() {
        return {
            markdown: {
                serialize(state, node) {
                    return state.renderList(node, "  ", () => (this.editor.storage.markdown.options.bulletListMarker || "-") + " ");
                },
                parse: {
                    // handled by markdown-it
                },
            }
        }
    }
});
