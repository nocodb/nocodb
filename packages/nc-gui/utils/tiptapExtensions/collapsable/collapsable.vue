<script lang="ts" setup>
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { TextSelection } from 'prosemirror-state'
import MdiTriangleDown from '~icons/tabler/triangle-inverted-filled'

const { node, editor, getPos } = defineProps(nodeViewProps)

const toggleCollapsableContent = () => {
  const pos = getPos()
  const tr = editor.state.tr
  const from = editor.state.selection.from
  tr.setNodeMarkup(pos, null, { ...node.attrs, collapsed: !node.attrs.collapsed })
  tr.setSelection(TextSelection.create(tr.doc, from))
  editor.view.dispatch(tr)
}
</script>

<template>
  <NodeViewWrapper class="vue-component collapsable-wrapper mt-2 w-full">
    <div
      class="flex flex-row space-x-1 w-full"
      :class="{
        collapsed: node.attrs.collapsed,
      }"
    >
      <div
        class="mt-1 flex items-center px-1 cursor-pointer hover:bg-gray-100 h-6 rounded-md z-10"
        @click.stop="toggleCollapsableContent"
      >
        <MdiTriangleDown
          class="h-2.5"
          :class="{
            'transform -rotate-90': node.attrs.collapsed,
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
