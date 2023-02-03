<script>
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'

export default {
  components: {
    NodeViewWrapper,
    NodeViewContent,
  },
  props: nodeViewProps,
  computed: {
    isTable() {
      const { content } = this.node.content

      return content[0].type.name === 'table'
    },
  },
  methods: {
    createNodeAfter() {
      const pos = this.getPos() + this.node.nodeSize

      this.editor.commands.insertContentAt(pos, {
        type: 'dBlock',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: '/',
              },
            ],
          },
        ],
      })
    },
  },
}
</script>

<template>
  <NodeViewWrapper class="vue-component group">
    <div class="flex flex-row gap-0.5 group w-full relative" tiptap-draghandle-wrapper="true">
      <div type="button" class="block-button cursor-pointer" :class="{ '!mt-8.5': isTable }" @click="createNodeAfter">
        <MdiPlus />
      </div>
      <div
        class="block-button cursor-move"
        contenteditable="false"
        :class="{ '!mt-8.5': isTable }"
        :draggable="true"
        :data-drag-handle="true"
        :tiptap-draghandle="true"
      >
        <IcBaselineDragIndicator :tiptap-draghandle="true" />
      </div>

      <NodeViewContent class="node-view-content w-full ml-0.5" :class="{ 'ml-1': isTable }" />
    </div>
  </NodeViewWrapper>
</template>

<style lang="scss" scoped>
.block-button {
  @apply opacity-0 group-hover:opacity-100 hover:bg-gray-50 rounded-sm text-lg py-0.5 h-6 mt-3;
  color: rgb(203, 203, 203);
}
</style>
