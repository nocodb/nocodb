<script lang="ts" setup>
import { defineProps } from 'vue'
import type { Editor, Mark } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3'

const { editor } = defineProps<Props>()

interface Props {
  editor: Editor
}

const linkNodeMark = ref<Mark | undefined>()
const href = ref('')

const checkLinkMark = (editor: Editor) => {
  const activeNode = editor?.state?.selection?.$from?.nodeBefore || editor?.state?.selection?.$from?.nodeAfter

  const isLinkMarkedStoredInEditor = editor?.state?.storedMarks?.some((mark: Mark) => mark.type.name === 'link')

  const isActiveNodeMarkActive = activeNode?.marks?.some((mark: Mark) => mark.type.name === 'link') || isLinkMarkedStoredInEditor

  if (isActiveNodeMarkActive) {
    linkNodeMark.value = activeNode?.marks.find((mark: Mark) => mark.type.name === 'link')
    href.value = linkNodeMark.value?.attrs?.href
  }

  if (isLinkMarkedStoredInEditor) {
    linkNodeMark.value = editor?.state?.storedMarks?.find((mark: Mark) => mark.type.name === 'link')
    href.value = linkNodeMark.value?.attrs?.href
  }

  // check if active node is a text node
  return isActiveNodeMarkActive
}
</script>

<template>
  <BubbleMenu :editor="editor" :tippy-options="{ duration: 100, maxWidth: 600 }" :should-show="checkLinkMark">
    <div class="bubble-menu flex flex-row gap-x-1 bg-gray-50 py-1 rounded-lg px-1">
      <div class="!border-1 !border-gray-200 m-0.5 !py-0.5 rounded-md bg-gray-100">
        <a-input v-model:value="href" class="flex-1 !w-96 !mx-1 !rounded-md" :bordered="false" placeholder="https://" />
      </div>
    </div>
  </BubbleMenu>
</template>

<style lang="scss">
.bubble-menu {
  // shadow
  @apply shadow-gray-200 shadow-sm;

  .is-active {
    background-color: #e5e5e5;
  }
  .menu-button {
    @apply rounded-md !py-0 !my-0 !px-1.5 !h-8;

    &:hover {
      background-color: #e5e5e5;
    }
  }
  .divider {
    @apply border-r border-gray-200 !h-6 !mx-0.5 my-1;
  }
  .ant-select-selector {
    @apply !rounded-md;
  }
  .ant-select-selector .ant-select-selection-item {
    @apply !text-xs;
  }
  .ant-btn-loading-icon {
    @apply pb-0.5;
  }
}
</style>
