<script lang="ts" setup>
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'

const { node, getPos, editor } = defineProps(nodeViewProps)

const isDragging = ref(false)

const prevColumnContentPos = computed(() => {
  const state = editor.view.state
  const currentColumnContentPos = getPos()
  const currentColumnContentResolvedPos = state.doc.resolve(currentColumnContentPos)

  if (!currentColumnContentResolvedPos.nodeBefore) return null

  return currentColumnContentPos - currentColumnContentResolvedPos.nodeBefore.nodeSize
})

const resizeHandler = (mouseDownEvent: MouseEvent) => {
  const columnContentDom = (mouseDownEvent.target as HTMLElement).closest('.column-content')
  if (columnContentDom === null) return

  const startSize = { x: columnContentDom.clientWidth, y: columnContentDom.clientHeight }
  const startPosition = { x: mouseDownEvent.pageX, y: mouseDownEvent.pageY }

  function onMouseMove(mouseMoveEvent: MouseEvent) {
    isDragging.value = true
    // set cursor as resize
    document.body.style.cursor = 'ew-resize'

    const newWidth = startSize.x + startPosition.x - mouseMoveEvent.pageX

    let widthPercent = (newWidth / columnContentDom!.parentElement!.clientWidth) * 100
    widthPercent = Math.max(20, Math.min(80, widthPercent))

    if (!prevColumnContentPos.value) return

    const state = editor.view.state

    editor.view.dispatch(
      state.tr
        .setNodeMarkup(getPos(), null, {
          ...node.attrs,
          widthPercent,
        })
        .setNodeMarkup(prevColumnContentPos.value, null, {
          ...state.doc.nodeAt(prevColumnContentPos.value)!.attrs,
          widthPercent: 100 - widthPercent,
        }),
    )
  }
  function onMouseUp() {
    // reset cursor
    document.body.style.cursor = 'auto'
    document.body.removeEventListener('mousemove', onMouseMove)

    isDragging.value = false
  }

  document.body.addEventListener('mousemove', onMouseMove)
  document.body.addEventListener('mouseup', onMouseUp, { once: true })
}

watch(isDragging, () => {
  if (isDragging.value) {
    editor.chain().blur().run()
  } else {
    editor.chain().focus().run()
  }
})
</script>

<template>
  <NodeViewWrapper
    class="vue-component relative column-content"
    data-type="column-content"
    :style="{
      width: `${node.attrs.widthPercent}%`,
    }"
  >
    <div v-if="prevColumnContentPos" class="flex justify-center h-full w-10 absolute -left-12 group">
      <div
        class="h-full w-2 bg-gray-200 rounded-md invisible group-hover:visible"
        :class="{
          '!visible': isDragging,
        }"
        :style="{
          cursor: 'ew-resize',
        }"
        @mousedown="resizeHandler"
      ></div>
    </div>
    <NodeViewContent />
  </NodeViewWrapper>
</template>
