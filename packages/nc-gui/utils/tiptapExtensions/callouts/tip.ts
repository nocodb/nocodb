import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import CalloutComponent from './callout.vue'
import { handleOnBackspaceForCallouts, handleOnEnterForCallouts } from './helper'

export interface TipCalloutOptions {
  HTMLAttributes: Record<string, any>
}

export const TipCallout = Node.create<TipCalloutOptions>({
  name: 'tipCallout',

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'tip-callout items-baseline',
      },
    }
  },
  content: 'block*',

  group: 'block',

  parseHTML() {
    return [{ tag: 'div[data-type="tip-callout"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'tip-callout' }), 0]
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
