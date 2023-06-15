<script lang="ts" setup>
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'

const { node, editor, getPos } = defineProps(nodeViewProps)

const emojiChange = (emoji: string) => {
  const attrs = { ...node.attrs }
  attrs.emoji = emoji
  const pos = getPos()
  const tr = editor.state.tr.setNodeMarkup(pos, undefined, attrs)
  editor.view.dispatch(tr)
}
</script>

<template>
  <NodeViewWrapper class="tiptap-vue-component callout-wrapper">
    <div class="flex flex-row gap-x-0.5 callout break-words" :data-bg-color="node.attrs.bgColor">
      <div class="flex select-none" contenteditable="false">
        <GeneralEmojiPicker :emoji="node.attrs.emoji" @emoji-selected="emojiChange" />
      </div>
      <NodeViewContent class="w-full" />
    </div>
  </NodeViewWrapper>
</template>
