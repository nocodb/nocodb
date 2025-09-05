<script lang="ts" setup>
import type { Editor } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3'

interface Props {
  editor: Editor
  hideMention?: boolean
  hideOnSelectAllSortcut?: boolean
}

const props = defineProps<Props>()

const editor = computed(() => props.editor)

const isSelectAllShortcut = ref(false)

// Debounce show menu to prevent flickering
const showMenu = computed(() => {
  if (!editor || isSelectAllShortcut.value) return false

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
  if (isBubble || isSelectAllShortcut.value) {
    isSelectAllShortcut.value = false
    return
  }

  const pageContent = document.querySelector('.nc-textarea-rich-editor')
  pageContent?.classList.add('bubble-menu-hidden')
}

const handleEditorMouseUp = (e: MouseEvent) => {
  const domsInEvent = document.elementsFromPoint(e.clientX, e.clientY) as HTMLElement[]
  const isBubble = domsInEvent.some((dom) => dom?.classList?.contains('bubble-menu'))

  if (isBubble || isSelectAllShortcut.value) {
    isSelectAllShortcut.value = false
    return
  }

  setTimeout(() => {
    const pageContent = document.querySelector('.nc-textarea-rich-editor')
    pageContent?.classList.remove('bubble-menu-hidden')
  }, 100)
}

useEventListener('keydown', (e: KeyboardEvent) => {
  if (!props.hideOnSelectAllSortcut) return

  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
    isSelectAllShortcut.value = true
  }
})

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
