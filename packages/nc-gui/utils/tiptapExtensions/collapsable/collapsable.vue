<script lang="ts" setup>
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { TextSelection } from 'prosemirror-state'
import { positionOfFirstChild } from '../helper'
import MdiTriangleDown from '~icons/tabler/triangle-inverted-filled'

const { editor } = defineProps(nodeViewProps)

const isCollapsed = ref(true)

const toggleCollapsableContent = () => {
  const state = editor.state
  const selection = state.selection
  const tr = editor.state.tr

  if (isCollapsed.value) {
    // Select first child of collapsable content
    const collapsableContentPos = getPosOfChildNodeOfType({
      state,
      nodeType: 'collapsable_content',
    })!
    const firstChildOfCollapseContentPos = positionOfFirstChild(state, collapsableContentPos, 'start')!

    tr.setSelection(TextSelection.create(tr.doc, firstChildOfCollapseContentPos))
  } else {
    // Put cursor on the start of the collapsable node
    tr.setSelection(TextSelection.create(tr.doc, selection.from))
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
