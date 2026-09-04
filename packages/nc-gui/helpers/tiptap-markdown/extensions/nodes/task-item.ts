import type { KeyboardShortcutCommand } from '@tiptap/core'
import { Node, mergeAttributes, wrappingInputRule } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Fragment, Slice } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { MarkdownNodeSpec } from '../../types'

export interface TaskItemOptions {
  onReadOnlyChecked?: (node: ProseMirrorNode, checked: boolean) => boolean
  nested: boolean
  HTMLAttributes: Record<string, any>
  taskListTypeName: string
  /**
   * Id of the user to credit when this editor toggles an item. Returning null
   * (public reader, unresolved session) records the toggle without an actor.
   */
  getActorId?: () => string | null | undefined
}

export const inputRegex = /^\s*\[( |x)?\]\s$/i

/**
 * Clear task attribution from a ProseMirror JSON document, in place of the
 * paste-time strip for flows that copy content as JSON (page duplicate).
 * Returns a new document; the input is left untouched.
 */
export function stripTaskAttribution<T>(content: T): T {
  if (Array.isArray(content)) {
    return content.map((child) => stripTaskAttribution(child)) as unknown as T
  }

  if (!content || typeof content !== 'object') return content

  const node = content as Record<string, any>
  const next: Record<string, any> = { ...node }

  if (node.type === 'taskItem' && node.attrs) {
    next.attrs = { ...node.attrs, checkedBy: null, checkedAt: null }
  }

  if (node.content) next.content = stripTaskAttribution(node.content)

  return next as T
}

// TODO: Extend from tiptap extension
export const TaskItem = Node.create<TaskItemOptions, { markdown: MarkdownNodeSpec }>({
  name: 'taskItem',

  addOptions() {
    return {
      ...this.parent?.(),
      nested: false,
      HTMLAttributes: {},
      taskListTypeName: 'taskList',
    }
  },

  content() {
    return this.options.nested ? 'paragraph block*' : 'paragraph+'
  },

  defining: true,

  addAttributes() {
    return {
      checked: {
        default: false,
        keepOnSplit: false,
        parseHTML: (element) => element.getAttribute('data-checked') === 'true',
        renderHTML: (attributes) => ({
          'data-checked': attributes.checked,
        }),
      },
      // Attribution for the most recent toggle — who and when. Only the last
      // one is kept; there is no per-item history.
      checkedBy: {
        default: null,
        keepOnSplit: false,
        parseHTML: (element) => element.getAttribute('data-checked-by') || null,
        renderHTML: (attributes) => (attributes.checkedBy ? { 'data-checked-by': attributes.checkedBy } : {}),
      },
      checkedAt: {
        default: null,
        keepOnSplit: false,
        parseHTML: (element) => element.getAttribute('data-checked-at') || null,
        renderHTML: (attributes) => (attributes.checkedAt ? { 'data-checked-at': attributes.checkedAt } : {}),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: `li[data-type="${this.name}"]`,
        priority: 51,
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'li',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': this.name,
      }),
      [
        'label',
        [
          'input',
          {
            type: 'checkbox',
            checked: node.attrs.checked ? 'checked' : null,
          },
        ],
        ['span'],
      ],
      ['div', 0],
    ]
  },

  addKeyboardShortcuts() {
    const shortcuts: {
      [key: string]: KeyboardShortcutCommand
    } = {
      'Enter': () => this.editor.commands.splitListItem(this.name),
      'Shift-Tab': () => this.editor.commands.liftListItem(this.name),
    }

    if (!this.options.nested) {
      return shortcuts
    }

    return {
      ...shortcuts,
      Tab: () => this.editor.commands.sinkListItem(this.name),
    }
  },

  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      const listItem = document.createElement('li')
      const checkboxWrapper = document.createElement('label')
      const checkboxStyler = document.createElement('span')
      const checkbox = document.createElement('input')
      const content = document.createElement('div')

      checkboxWrapper.contentEditable = 'false'
      checkbox.type = 'checkbox'
      checkbox.addEventListener('change', (event) => {
        // if the editor isn’t editable and we don't have a handler for
        // readonly checks we have to undo the latest change
        if (!editor.isEditable && !this.options.onReadOnlyChecked) {
          checkbox.checked = !checkbox.checked

          return
        }

        const { checked } = event.target as any

        if (editor.isEditable && typeof getPos === 'function') {
          editor
            .chain()
            .focus(undefined, { scrollIntoView: false })
            .command(({ tr }) => {
              const position = getPos()
              const currentNode = tr.doc.nodeAt(position)

              tr.setNodeMarkup(position, undefined, {
                ...currentNode?.attrs,
                checked,
                checkedBy: this.options.getActorId?.() ?? null,
                checkedAt: new Date().toISOString(),
              })

              return true
            })
            .run()
        }
        if (!editor.isEditable && this.options.onReadOnlyChecked) {
          // Reset state if onReadOnlyChecked returns false
          if (!this.options.onReadOnlyChecked(node, checked)) {
            checkbox.checked = !checkbox.checked
          }
        }
      })

      Object.entries(this.options.HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, value)
      })

      // Attribution is read off the DOM by the hover overlay, so it has to be
      // re-applied on every update — unlike the create-time HTMLAttributes,
      // which go stale the moment someone toggles the box.
      const syncAttribution = (attrs: ProseMirrorNode['attrs']) => {
        if (attrs.checkedBy) listItem.dataset.checkedBy = attrs.checkedBy
        else delete listItem.dataset.checkedBy

        if (attrs.checkedAt) listItem.dataset.checkedAt = attrs.checkedAt
        else delete listItem.dataset.checkedAt
      }

      // `renderHTML` stamps this, but the node view builds its own element and
      // bypasses it — leaving the live DOM without the marker that `parseHTML`
      // (and anything selecting task rows) keys on.
      listItem.dataset.type = this.name

      listItem.dataset.checked = node.attrs.checked
      syncAttribution(node.attrs)
      // Set the property, not the attribute: the attribute stops reflecting once the checkbox has been clicked
      checkbox.checked = node.attrs.checked

      checkboxWrapper.append(checkbox, checkboxStyler)
      listItem.append(checkboxWrapper, content)

      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, value)
      })

      return {
        dom: listItem,
        contentDOM: content,
        update: (updatedNode) => {
          if (updatedNode.type !== this.type) {
            return false
          }

          listItem.dataset.checked = updatedNode.attrs.checked
          syncAttribution(updatedNode.attrs)
          checkbox.checked = updatedNode.attrs.checked

          return true
        },
      }
    }
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: inputRegex,
        type: this.type,
        getAttributes: (match) => ({
          checked: match[match.length - 1]?.toLowerCase() === 'x',
        }),
      }),
    ]
  },

  addProseMirrorPlugins() {
    const taskItemType = this.type

    // Attribution is about who ticked a box *in this document*. Pasted content
    // was ticked somewhere else, so drop the actor rather than credit them for
    // a copy they never saw. The checked state itself is kept.
    const stripAttribution = (fragment: Fragment): Fragment => {
      const nodes: ProseMirrorNode[] = []

      fragment.forEach((node) => {
        const content = stripAttribution(node.content)

        if (node.type === taskItemType && (node.attrs.checkedBy || node.attrs.checkedAt)) {
          nodes.push(node.type.create({ ...node.attrs, checkedBy: null, checkedAt: null }, content, node.marks))
        } else {
          nodes.push(node.copy(content))
        }
      })

      return Fragment.fromArray(nodes)
    }

    return [
      new Plugin({
        key: new PluginKey('taskItemAttributionPaste'),
        props: {
          transformPasted: (slice) => new Slice(stripAttribution(slice.content), slice.openStart, slice.openEnd),
        },
      }),
    ]
  },

  addStorage() {
    return {
      markdown: {
        serialize(state, node) {
          const check = node.attrs.checked ? '[x]' : '[ ]'
          state.write(`${check} `)
          state.renderContent(node)
        },
        parse: {
          updateDOM(element) {
            ;[...element.querySelectorAll('.task-list-item')].forEach((item) => {
              const input = item.querySelector('input')
              item.setAttribute('data-type', 'taskItem')
              if (input) {
                item.setAttribute('data-checked', input.checked)
                input.remove()
              }
            })
          },
        },
      },
    }
  },
})
