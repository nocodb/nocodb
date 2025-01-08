import { Node } from "@tiptap/core";


const TaskItem = Node.create({
    name: 'taskItem',
});

export default TaskItem.extend({
    /**
     * @return {{markdown: MarkdownNodeSpec}}
     */
    addStorage() {
        return {
            markdown: {
                serialize(state, node) {
                    const check = node.attrs.checked ? '[x]' : '[ ]';
                    state.write(`${check} `);
                    state.renderContent(node);
                },
                parse: {
                    updateDOM(element) {
                        [...element.querySelectorAll('.task-list-item')]
                            .forEach(item => {
                                const input = item.querySelector('input');
                                item.setAttribute('data-type', 'taskItem');
                                if(input) {
                                    item.setAttribute('data-checked', input.checked);
                                    input.remove();
                                }
                            });
                    },
                }
            }
        }
    }
});
