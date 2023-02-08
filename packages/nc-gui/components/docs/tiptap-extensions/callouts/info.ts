import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import CalloutComponent from './callout.vue'

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
  content: 'inline*',

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
})
