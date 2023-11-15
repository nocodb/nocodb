<script lang="ts" setup>
import type { Editor } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3'
import MdiFormatBulletList from '~icons/mdi/format-list-bulleted'
import MdiFormatStrikeThrough from '~icons/mdi/format-strikethrough'
import MdiFormatListNumber from '~icons/mdi/format-list-numbered'
import MdiFormatListCheckbox from '~icons/mdi/format-list-checkbox'

const { editor } = defineProps<Props>()

interface Props {
  editor: Editor
}

// Debounce show menu to prevent flickering
const showMenu = computed(() => {
  if (!editor) return false

  return !editor.state.selection.empty
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

  const pageContent = document.querySelector('.nc-docs-page-wrapper')
  pageContent?.classList.add('bubble-menu-hidden')
}

const handleEditorMouseUp = (e: MouseEvent) => {
  const domsInEvent = document.elementsFromPoint(e.clientX, e.clientY) as HTMLElement[]
  const isBubble = domsInEvent.some((dom) => dom?.classList?.contains('bubble-menu'))
  if (isBubble) return

  setTimeout(() => {
    const pageContent = document.querySelector('.nc-docs-page-wrapper')
    pageContent?.classList.remove('bubble-menu-hidden')
  }, 100)
}

const onToggleLink = () => {
  const activeNode = editor?.state?.selection?.$from?.nodeBefore || editor?.state?.selection?.$from?.nodeAfter

  const isLinkMarkedStoredInEditor = editor?.state?.storedMarks?.some((mark: Mark) => mark.type.name === 'link')

  const isActiveNodeMarkActive = activeNode?.marks?.some((mark: Mark) => mark.type.name === 'link') || isLinkMarkedStoredInEditor

  if (isActiveNodeMarkActive) {
    editor!.chain().focus().unsetLink().run()
  } else {
    editor!
      .chain()
      .focus()
      .toggleLink({
        href: '',
      })
      .selectTextblockEnd()
      .run()

    setTimeout(() => {
      const linkInput = document.querySelector('.docs-link-option-input')
      if (linkInput) {
        ;(linkInput as any).focus()
      }
    }, 100)
  }
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
    <div v-if="showMenuDebounced" class="bubble-menu flex flex-row gap-x-1 bg-gray-100 py-1 rounded-lg px-1">
      <a-button
        type="text"
        :class="{ 'is-active': editor.isActive('bold') }"
        :aria-active="editor.isActive('bold')"
        class="menu-button"
        data-testid="nc-docs-editor-bold-button"
        @click="editor!.chain().focus().toggleBold().run()"
      >
        <MdiFormatBold />
      </a-button>
      <a-button
        type="text"
        :class="{ 'is-active': editor.isActive('italic') }"
        :aria-active="editor.isActive('italic')"
        class="menu-button"
        data-testid="nc-docs-editor-italic-button"
        @click=";(editor!.chain().focus() as any).toggleItalic().run()"
      >
        <MdiFormatItalic />
      </a-button>
      <a-button
        type="text"
        :class="{ 'is-active': editor.isActive('underline') }"
        :aria-active="editor.isActive('underline')"
        class="menu-button"
        data-testid="nc-docs-editor-underline-button"
        @click="editor!.chain().focus().toggleUnderline().run()"
      >
        <MdiFormatUnderline />
      </a-button>
      <a-button
        type="text"
        :class="{ 'is-active': editor.isActive('strike') }"
        :aria-active="editor.isActive('strike')"
        class="menu-button"
        data-testid="nc-docs-editor-strike-button"
        @click="editor!.chain().focus().toggleStrike().run()"
      >
        <MdiFormatStrikeThrough />
      </a-button>
      <div class="divider"></div>

      <a-button
        type="text"
        :class="{ 'is-active': editor.isActive('taskList') }"
        :aria-active="editor.isActive('taskList')"
        class="menu-button"
        data-testid="nc-docs-editor-task-button"
        @click="editor!.chain().focus().toggleTaskList().run()"
      >
        <MdiFormatListCheckbox />
      </a-button>
      <a-button
        type="text"
        :class="{ 'is-active': editor.isActive('bulletList') }"
        :aria-active="editor.isActive('bulletList')"
        class="menu-button"
        data-testid="nc-docs-editor-bullet-button"
        @click="editor!.chain().focus().toggleBulletList().run()"
      >
        <MdiFormatBulletList />
      </a-button>
      <a-button
        type="text"
        :class="{ 'is-active': editor.isActive('orderedList') }"
        :aria-active="editor.isActive('orderedList')"
        class="menu-button"
        data-testid="nc-docs-editor-ordered-button"
        @click="editor!.chain().focus().toggleOrderedList().run()"
      >
        <MdiFormatListNumber />
      </a-button>
      <div class="divider"></div>

      <a-button
        type="text"
        :class="{ 'is-active': editor.isActive('link') }"
        :aria-active="editor.isActive('link')"
        class="menu-button"
        data-testid="nc-docs-editor-link-button"
        @click="onToggleLink"
      >
        <div class="flex flex-row items-center px-0.5">
          <MdiLink />
          <div class="!text-xs !ml-1">Link</div>
        </div>
      </a-button>
    </div>
  </BubbleMenu>
</template>

<style lang="scss">
.bubble-menu-hidden {
  [data-tippy-root] {
    opacity: 0;
    height: 0;
    overflow: hidden;
    z-index: -1;
    user-select: none;
  }
}

.bubble-text-format-button-icon {
  @apply px-1.5 py-0 border-1 border-gray-300 rounded-sm items-center justify-center;
  font-size: 0.8rem;
  font-weight: 600;
}
.bubble-text-format-button {
  @apply rounded-md py-1 my-0 pl-2.5 pr-3 cursor-pointer items-center gap-x-2.5 hover:bg-gray-100;
}

.bubble-menu {
  // shadow
  @apply border-gray-100 bg-white;
  border-width: 1px;
  box-shadow: 0px 0px 1.2rem 0 rgb(230, 230, 230) !important;

  .is-active {
    @apply border-1 !hover:bg-gray-200 border-1 border-gray-200 bg-gray-100;
  }
  .menu-button {
    @apply rounded-md !py-0 !my-0 !px-1.5 !h-8 hover:bg-gray-100;
  }
  .divider {
    @apply border-r-1 border-gray-200 !h-6 !mx-0.5 my-1;
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
