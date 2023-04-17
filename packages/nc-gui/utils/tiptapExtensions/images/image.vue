<script lang="ts" setup>
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { LoadingOutlined } from '@ant-design/icons-vue'

const { node, editor, getPos } = defineProps(nodeViewProps)

const { isEditAllowed } = useDocStore()

const indicator = h(LoadingOutlined, {
  style: {
    fontSize: '18px',
  },
  spin: true,
})

const resizeHandler = (mouseDownEvent: MouseEvent, direction: 'left' | 'right') => {
  const parent = (mouseDownEvent.target as HTMLElement).closest('.image-wrapper')
  const image = parent?.querySelector('img.nc-docs-image') ?? null

  if (image === null) return

  const startSize = { x: image.clientWidth, y: image.clientHeight }
  const startPosition = { x: mouseDownEvent.pageX, y: mouseDownEvent.pageY }

  function onMouseMove(mouseMoveEvent: MouseEvent) {
    // set cursor as resize
    document.body.style.cursor = 'ew-resize'

    const newWidth =
      direction === 'left'
        ? startSize.x + startPosition.x - mouseMoveEvent.pageX
        : startSize.x - startPosition.x + mouseMoveEvent.pageX
    const newHeight = startSize.y - startPosition.y + mouseMoveEvent.pageY

    editor.view.dispatch(
      editor.view.state.tr.setNodeMarkup(getPos(), null, {
        ...node.attrs,
        width: newWidth,
        height: newHeight,
      }),
    )
  }
  function onMouseUp() {
    // reset cursor
    document.body.style.cursor = 'auto'
    document.body.removeEventListener('mousemove', onMouseMove)
  }

  document.body.addEventListener('mousemove', onMouseMove)
  document.body.addEventListener('mouseup', onMouseUp, { once: true })
}

const resizeLeft = (mouseDownEvent: MouseEvent) => {
  resizeHandler(mouseDownEvent, 'left')
}

const resizeRight = (mouseDownEvent: MouseEvent) => {
  resizeHandler(mouseDownEvent, 'right')
}
</script>

<template>
  <NodeViewWrapper class="vue-component image-wrapper">
    <div v-if="!isEditAllowed">
      <img
        class="nc-docs-image bg-gray-50"
        :alt="node.attrs.alt"
        :src="node.attrs.src"
        :title="node.attrs.title"
        :width="node.attrs.width"
        :height="node.attrs.height"
      />
    </div>
    <div
      v-else
      class="relative image-wrapper my-2"
      :style="{
        width: node.attrs.isUploading ? '100%' : 'fit-content',
      }"
    >
      <div v-if="node.attrs.isUploading" class="flex flex-row space-x-4 px-4 py-2.5 bg-gray-100 rounded-md w-full items-baseline">
        <a-spin :indicator="indicator" class="!text-gray-500 flex" />
        <div class="flex text-sm text-gray-600">Uploading</div>
      </div>
      <template v-else>
        <img
          class="nc-docs-image bg-gray-50"
          :alt="node.attrs.alt"
          :src="node.attrs.src"
          :title="node.attrs.title"
          :width="node.attrs.width"
          :height="node.attrs.height"
          :class="{
            'tiptap-img-selected': editor.isActive('image', { src: node.attrs.src }),
          }"
        />
        <div
          class="tiptap-img-resize-bar right-0.25"
          :class="{
            '!visible': editor.isActive('image', { src: node.attrs.src }),
          }"
          @mousedown="resizeRight"
        >
          <div class="tiptap-img-resize-bar-inner"></div>
        </div>
        <div
          class="tiptap-img-resize-bar -left-0.75"
          :class="{
            '!visible': editor.isActive('image', { src: node.attrs.src }),
          }"
          @mousedown="resizeLeft"
        >
          <div class="tiptap-img-resize-bar-inner"></div>
        </div>
      </template>
    </div>
  </NodeViewWrapper>
</template>

<style lang="scss" scoped>
.ProseMirror {
  .selected {
    .nc-docs-image {
      outline: 3px solid #e8eafd;
      outline-offset: -2px;
      border-radius: 4px;
    }
  }
  .nc-docs-image {
    min-width: 10rem;
  }
}
.tiptap-img-selected {
  outline: 3px solid #e8eafd;
  outline-offset: -2px;
  border-radius: 4px;
}
.tiptap-img-resize-bar {
  @apply absolute w-4 h-10 px-2 invisible group-hover:visible hover:visible;
  cursor: ew-resize;
  top: calc(50% - 1.25rem);
}
.tiptap-img-resize-bar-inner {
  @apply w-1 h-10 bg-gray-500 rounded-md;
  outline: 1px solid #fff;
}
</style>
