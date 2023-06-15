import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { TiptapNodesTypes } from 'nocodb-sdk'
import CalloutComponent from './callout.vue'
import { handleOnEnterForCallouts } from './helper'

export interface InfoCalloutOptions {
  HTMLAttributes: Record<string, any>
}

export const Callout = Node.create<InfoCalloutOptions>({
  name: TiptapNodesTypes.callout,

  addAttributes() {
    return {
      emoji: {
        default: '📝',
        parseHTML(element) {
          return {
            emoji: element.getAttribute('data-emoji'),
          }
        },
      },
    }
  },

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'callout',
      },
    }
  },
  content: 'block*',

  group: 'block',

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'callout' }), 0]
  },

  addNodeView() {
    return VueNodeViewRenderer(CalloutComponent)
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        return handleOnEnterForCallouts(editor as any)
      },
    }
  },
})
