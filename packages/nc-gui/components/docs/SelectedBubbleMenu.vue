<script lang="ts" setup>
// props: {editor: {type: Object, required: true}}
import { defineProps } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3'
import MdiFormatStrikeThrough from '~icons/mdi/format-strikethrough'
import MdiFormatBulletList from '~icons/mdi/format-list-bulleted'
import MdiFormatColor from '~icons/mdi/format-color'
interface Props {
  editor: Editor
}

const { editor } = defineProps<Props>()

const colorValue = ref('Black')

const isImageNode = computed(() => {
  const { state } = editor
  // active node of tiptap editor
  const activeNode = state.selection.$from.nodeAfter

  // check if active node is a text node
  return activeNode?.type.name === 'image'
})
</script>

<template>
  <BubbleMenu v-if="!isImageNode" :editor="editor" :tippy-options="{ duration: 100, maxWidth: 500 }">
    <div class="bubble-menu flex flex-row gap-x-1 bg-gray-100 py-1 rounded-lg px-1">
      <a-button
        type="text"
        :class="{ 'is-active': editor.isActive('bold') }"
        class="menu-button"
        @click="editor!.chain().focus().toggleBold().run()"
      >
        <MdiFormatBold />
      </a-button>
      <a-button
        type="text"
        :class="{ 'is-active': editor.isActive('italic') }"
        class="menu-button"
        @click="editor!.chain().focus().toggleItalic().run()"
      >
        <MdiFormatItalic />
      </a-button>
      <a-button
        type="text"
        :class="{ 'is-active': editor.isActive('underline') }"
        class="menu-button"
        @click="editor!.chain().focus().toggleUnderline().run()"
      >
        <MdiFormatUnderline />
      </a-button>
      <div class="divider"></div>
      <a-button
        type="text"
        :class="{ 'is-active': editor.isActive('strike') }"
        class="menu-button"
        @click="editor!.chain().focus().toggleStrike().run()"
      >
        <MdiFormatStrikeThrough />
      </a-button>
      <a-button
        type="text"
        :class="{ 'is-active': editor.isActive('bulletList') }"
        class="menu-button"
        @click="editor!.chain().focus().toggleBulletList().run()"
      >
        <MdiFormatBulletList />
      </a-button>

      <div class="divider"></div>

      <a-button
        type="text"
        :class="{ 'is-active': editor.isActive('link') }"
        class="menu-button"
        @click="editor!.chain().focus().toggleLink().run()"
      >
        <div class="flex flex-row items-center px-0.5">
          <MdiLink />
          <div class="!text-xs !ml-1">Add Link</div>
        </div>
      </a-button>

      <div class="divider"></div>

      <a-select v-model:value="colorValue" style="width: 6rem" size="small" class="flex !my-auto !mr-1">
        <a-select-option value="Black">
          <div class="flex flex-row items-center h-5 my-auto">
            <MdiFormatColor class="flex mt-0.5 mr-2.5" />
            <div class="flex my-auto">Black</div>
          </div>
        </a-select-option>
        <!-- <a-select-option value="Red">Red</a-select-option>
        <a-select-option value="Blue">Blue</a-select-option>
        <a-select-option value="Yellow">Yellow</a-select-option> -->
      </a-select>
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
}
</style>
