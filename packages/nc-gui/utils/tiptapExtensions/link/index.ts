import TiptapLink from '@tiptap/extension-link'
import { getAttributes } from '@tiptap/core'
import { Plugin } from 'prosemirror-state'

export const Link = TiptapLink.extend({
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleClick(view, pos, event) {
            const attrs = getAttributes(view.state, 'link')

            if (view.editable && !event.metaKey) {
              return true
            }

            const link = (event.target as HTMLElement)?.closest('a')

            if (link && attrs.href) {
              window.open(attrs.href, attrs.target)

              return true
            }

            return false
          },
        },
      }),
    ]
  },
}).configure({
  openOnClick: false,
})
