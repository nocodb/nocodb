<script lang="ts" setup>
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { TextSelection } from 'prosemirror-state'
import MdiTriangleDown from '~icons/tabler/triangle-inverted-filled'

const { editor, getPos } = defineProps(nodeViewProps)

const isCollapsed = ref(true)

const toggleCollapsableContent = () => {
  const pos = getPos()
  const tr = editor.state.tr
  const from = editor.state.selection.from
  if (isCollapsed.value) {
    const posResolve = editor.state.doc.resolve(pos)
    const contentPos = posResolve.after()

    editor.state.doc.nodesBetween(pos, contentPos, (node, collapsableContentPos) => {
      if (node.type.name === 'collapsable_content') {
        const contentPosResolve = editor.state.doc.resolve(collapsableContentPos)
        let textNodePos = collapsableContentPos
        editor.state.doc.nodesBetween(collapsableContentPos, contentPosResolve.after(), (node, pos) => {
          if (
            (node.type.name === 'paragraph' || node.type.name === 'heading' || node.type.name === 'text') &&
            textNodePos === collapsableContentPos
          ) {
            textNodePos = pos
          }
        })

        tr.setSelection(TextSelection.create(tr.doc, textNodePos))
      }
    })
  } else {
    tr.setSelection(TextSelection.create(tr.doc, from))
  }
  editor.view.dispatch(tr)
  isCollapsed.value = !isCollapsed.value
}
</script>

<template>
  <NodeViewWrapper class="vue-component collapsable-wrapper mt-2 w-full">
    <div
      class="flex flex-row space-x-1 w-full"
      :class="{
        collapsed: isCollapsed,
      }"
    >
      <div
        class="mt-1 flex items-center px-1 cursor-pointer hover:bg-gray-100 h-6 rounded-md z-10"
        @click.stop="toggleCollapsableContent"
      >
        <MdiTriangleDown
          class="h-2.5"
          :class="{
            'transform -rotate-90': isCollapsed,
          }"
        />
      </div>
      <NodeViewContent class="flex flex-col flex-grow w-full" />
    </div>
  </NodeViewWrapper>
</template>

<style lang="scss">
.ProseMirror .vue-component.collapsable-wrapper {
  .collapsed {
    [data-type='collapsable_content'] {
      display: none;
    }
  }
}
</style>
