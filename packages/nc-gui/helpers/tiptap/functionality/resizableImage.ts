import { VueNodeViewRenderer } from '@tiptap/vue-3'
import ImageNode from '~/components/cell/RichText/ImageNode.vue'
import { Image } from '~/helpers/tiptap-markdown/extensions'

/** The Rich Text cell's image: drag a corner handle to set its width. */
export const ResizableImage = Image.extend({
  addNodeView() {
    return VueNodeViewRenderer(ImageNode)
  },
})
