<script lang="ts" setup>
// props: {editor: {type: Object, required: true}}
import { defineProps } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3'

interface Props {
  editor: Editor
}

const { editor } = defineProps<Props>()
</script>

<template>
  <BubbleMenu :editor="editor" :tippy-options="{ duration: 100 }">
    <div class="flex flex-row gap-x-1 mb-1">
      <button
        :class="{ 'is-active': editor.isActive('bold') }"
        class="px-1 border-black border bg-white"
        @click="editor!.chain().focus().toggleBold().run()"
      >
        bold
      </button>
      <button
        :class="{ 'is-active': editor.isActive('italic') }"
        class="px-1 border-black border bg-white"
        @click="editor!.chain().focus().toggleItalic().run()"
      >
        italic
      </button>
      <button
        :class="{ 'is-active': editor.isActive('strike') }"
        class="px-1 border-black border bg-white"
        @click="editor!.chain().focus().toggleStrike().run()"
      >
        strike
      </button>
      <button
        :class="{ 'is-active': editor.isActive('strike') }"
        class="px-1 border-black border bg-white"
        @click="editor!.chain().focus().toggleBulletList().run()"
      >
        bullet
      </button>
    </div>
  </BubbleMenu>
</template>
