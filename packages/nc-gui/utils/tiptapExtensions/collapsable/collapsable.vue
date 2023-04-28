<script lang="ts" setup>
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { TextSelection } from 'prosemirror-state'
import { TiptapNodesTypes } from 'nocodb-sdk'
import { positionOfFirstChild } from '../helper'

const { node, editor } = defineProps(nodeViewProps)

const isCollapsed = ref(true)

const toggleCollapsableContent = () => {
  const state = editor.state
  const selection = state.selection
  const tr = editor.state.tr

  if (isCollapsed.value) {
    // Select first child of collapsable content
    const collapsableContentPos = getPosOfChildNodeOfType({
      state,
      nodeType: TiptapNodesTypes.collapsableContent,
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

const headerChildNode = computed(() => {
  const { content } = node.content as any
  if (!content || !(content.length > 0)) return undefined

  const headerNode = content[0]

  return headerNode?.content?.firstChild
})
</script>

<template>
  <NodeViewWrapper
    class="vue-component collapsable-wrapper mt-2 w-full"
    :class="{
      '!mt-0': headerChildNode?.type.name === 'heading' && headerChildNode?.attrs.level === 1,
    }"
  >
    <div
      class="flex flex-row space-x-1 w-full items-start"
      :class="{
        collapsed: isCollapsed,
      }"
    >
      <div
        class="mt-1 flex items-center px-1 cursor-pointer hover:bg-gray-100 h-6 rounded-md z-10 group"
        :class="{
          '!mt-3': headerChildNode?.type.name === 'heading' && headerChildNode?.attrs.level === 1,
          '!mt-1.75': headerChildNode?.type.name === 'heading' && headerChildNode?.attrs.level === 2,
          '!mt-0.5': headerChildNode?.type.name === 'heading' && headerChildNode?.attrs.level === 3,
        }"
        @click.stop="toggleCollapsableContent"
      >
        <MdiTriangle
          class="h-2.5 text-gray-500 group-hover:text-gray-700"
          :class="{
            'transform rotate-180': !isCollapsed,
            'transform rotate-90': isCollapsed,
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
