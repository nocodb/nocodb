import { Node } from "@tiptap/core";
import HTMLNode from './html';

const HardBreak = Node.create({
    name: 'hardBreak',
});

export default HardBreak.extend({
    /**
     * @return {{markdown: MarkdownNodeSpec}}
     */
    addStorage() {
        return {
            markdown: {
                serialize(state, node, parent, index) {
                    for (let i = index + 1; i < parent.childCount; i++)
                        if (parent.child(i).type != node.type) {
                            state.write(
                                state.inTable
                                    ? HTMLNode.storage.markdown.serialize.call(this, state, node, parent)
                                    : "\\\n"
                            );
                            return;
                        }
                },
                parse: {
                    // handled by markdown-it
                },
            }
        }
    }
});
