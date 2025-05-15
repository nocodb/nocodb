<script lang="ts" setup>
import type { Editor } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3'

interface Props {
  editor: Editor
  hideMention?: boolean
}

const props = defineProps<Props>()

const editor = computed(() => props.editor)

// Debounce show menu to prevent flickering
const showMenu = computed(() => {
  if (!editor) return false

  return !editor.value.state.selection.empty
})
const showMenuDebounced = ref(false)

watchDebounced(
  () => showMenu.value,
  (value) => {
    showMenuDebounced.value = value
  },
  {
    debounce: 200,
    maxWait: 800,
    immediate: true,
  },
)

const handleEditorMouseDown = (e: MouseEvent) => {
  const domsInEvent = document.elementsFromPoint(e.clientX, e.clientY) as HTMLElement[]
  const isBubble = domsInEvent.some((dom) => dom?.classList?.contains('bubble-menu'))
  if (isBubble) return

  const pageContent = document.querySelector('.nc-textarea-rich-editor')
  pageContent?.classList.add('bubble-menu-hidden')
}

const handleEditorMouseUp = (e: MouseEvent) => {
  const domsInEvent = document.elementsFromPoint(e.clientX, e.clientY) as HTMLElement[]
  const isBubble = domsInEvent.some((dom) => dom?.classList?.contains('bubble-menu'))
  if (isBubble) return

  setTimeout(() => {
    const pageContent = document.querySelector('.nc-textarea-rich-editor')
    pageContent?.classList.remove('bubble-menu-hidden')
  }, 100)
}

onMounted(() => {
  document.addEventListener('mouseup', handleEditorMouseUp)
  document.addEventListener('mousedown', handleEditorMouseDown)
})

onUnmounted(() => {
  document.removeEventListener('mouseup', handleEditorMouseUp)
  document.removeEventListener('mousedown', handleEditorMouseDown)
})
</script>

<template>
  <BubbleMenu :editor="editor" :update-delay="300" :tippy-options="{ duration: 100, maxWidth: 600 }">
    <CellRichTextSelectedBubbleMenu v-if="showMenuDebounced" :editor="editor" :hide-mention="hideMention" />
  </BubbleMenu>
</template>
