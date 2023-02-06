import { defineComponent, h } from 'vue'

export const NodeViewWrapper = defineComponent({
  inject: ['onDragStart', 'decorationClasses'],
  props: {
    as: {
      type: String,
      default: 'div',
    },
  },

  render() {
    console.log('NodeViewWrapper.render()', this.$slots.default?.())
    return h(
      this.as,
      {
        // @ts-expect-error - Fix this
        'class': this.decorationClasses,
        'style': {
          whiteSpace: 'normal',
        },
        'data-node-view-wrapper': '',
        // @ts-expect-error - Fix this
        'onDragstart': this.onDragStart,
      },
      this.$slots.default?.(),
    )
  },
})
