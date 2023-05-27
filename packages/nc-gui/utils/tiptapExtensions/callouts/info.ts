import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { TiptapNodesTypes } from 'nocodb-sdk'
import CalloutComponent from './callout.vue'
import { handleOnEnterForCallouts } from './helper'

export interface InfoCalloutOptions {
  HTMLAttributes: Record<string, any>
}

export const InfoCallout = Node.create<InfoCalloutOptions>({
  name: TiptapNodesTypes.infoCallout,

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'callout info-callout items-baseline',
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
      Enter: ({ editor }) => {
        return handleOnEnterForCallouts(editor as any, TiptapNodesTypes.infoCallout)
      },
    }
  },
})
