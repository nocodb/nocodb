import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import CalloutComponent from './callout.vue'
import { handleOnBackspaceForCallouts, handleOnEnterForCallouts } from './helper'

export interface InfoCalloutOptions {
  HTMLAttributes: Record<string, any>
}

export const InfoCallout = Node.create<InfoCalloutOptions>({
  name: 'infoCallout',

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'info-callout items-baseline',
      },
    }
  },
  content: 'block*',

  group: 'block',

  parseHTML() {
    return [{ tag: 'div[data-type="info-callout"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'info-callout' }), 0]
  },

  addNodeView() {
    return VueNodeViewRenderer(CalloutComponent)
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Alt-0': () => this.editor.commands.setDBlock(),
      'Enter': ({ editor }) => {
        return handleOnEnterForCallouts(editor as any)
      },
      'Backspace': ({ editor }) => {
        return handleOnBackspaceForCallouts(editor as any)
      },
    }
  },
})
