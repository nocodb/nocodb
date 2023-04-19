import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import CalloutComponent from './callout.vue'
import { handleOnBackspaceForCallouts, handleOnEnterForCallouts } from './helper'

export interface WarningCalloutOptions {
  HTMLAttributes: Record<string, any>
}

export const WarningCallout = Node.create<WarningCalloutOptions>({
  name: 'warningCallout',

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'warning-callout items-baseline',
      },
    }
  },
  content: 'block*',

  group: 'block',

  parseHTML() {
    return [{ tag: 'div[data-type="warning-callout"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'warning-callout' }), 0]
  },

  addNodeView() {
    return VueNodeViewRenderer(CalloutComponent)
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        return handleOnEnterForCallouts(editor as any)
      },
      Backspace: ({ editor }) => {
        return handleOnBackspaceForCallouts(editor as any)
      },
    }
  },
})
