<script lang="ts" setup>
import { defineProps } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3'
import type { Mark } from 'prosemirror-model'
import { CellSelection } from '@tiptap/pm/tables'
import { TiptapNodesTypes } from 'nocodb-sdk'
import MdiFormatBulletList from '~icons/mdi/format-list-bulleted'
import MdiFormatStrikeThrough from '~icons/mdi/format-strikethrough'
import MdiFormatListNumber from '~icons/mdi/format-list-numbered'
import MdiFormatListCheckbox from '~icons/mdi/format-list-checkbox'
import { tiptapTextColor } from '~/utils/tiptapExtensions/helper'
import { AISelection } from '~~/utils/tiptapExtensions/AISelection'

const { editor } = defineProps<Props>()

const { project } = storeToRefs(useProject())

const { gptPageExpand } = useDocStore()

interface Props {
  editor: Editor
}

// const colorValue = ref('Black')
const isMagicExpandLoading = ref(false)

const isImageNode = computed(() => {
  // active node of tiptap editor
  const activeNode = editor?.state?.selection?.$from?.nodeAfter

  // check if active node is a text node
  return activeNode?.type?.name === 'image'
})
const isImageNodeDebounced = ref(isImageNode.value)

const parentIsTableCell = computed(() => {
  if (!editor) return false

  let parent = editor.state.selection.$from.node(-1)
  parent =
    parent?.type.name === TiptapNodesTypes.tableCell && editor.state.selection.$from.depth > 4
      ? parent
      : editor.state.selection.$from.node(-2)

  return parent?.type.name === TiptapNodesTypes.tableCell
})

const parentIsCallout = computed(() => {
  if (!editor) return false

  let parent = editor.state.selection.$from.node(-1)
  parent =
    parent?.type.name === TiptapNodesTypes.tableCell && editor.state.selection.$from.depth > 4
      ? parent
      : editor.state.selection.$from.node(-2)

  return parent?.type.name === TiptapNodesTypes.callout
})

const isTableCellSelected = computed(() => {
  if (!editor) return false

  const selection = editor.state.selection

  return selection instanceof CellSelection
})

// Debounce show menu to prevent flickering
const showMenu = computed(() => {
  if (!editor) return false

  const isNonSelectableNodesSelected = isImageNodeDebounced.value

  return !editor.state.selection.empty && !isNonSelectableNodesSelected
})
const showMenuDebounced = ref(false)

const isBulletActive = computed(() => {
  const plugin = editor.state.plugins.find((plugin) => (plugin as any).key.includes('bullet'))
  return plugin?.getState(editor.state).active
})

const isOrderedActive = computed(() => {
  const plugin = editor.state.plugins.find((plugin) => (plugin as any).key.includes('ordered'))
  return plugin?.getState(editor.state).active
})

const isCheckboxActive = computed(() => {
  const plugin = editor.state.plugins.find((plugin) => (plugin as any).key.includes('task'))
  return plugin?.getState(editor.state).active
})

const expandText = async () => {
  const selection = editor?.state?.selection

  if (!selection) return

  const tr = editor.state.tr

  const fromSec = getPositionOfSection(editor.state, selection.from + 1, 'start')
  const toSec = getPositionOfNextSection(editor.state, selection.to - 1, 'start') ?? editor.state.doc.content.size
    const markdown = converter.makeMarkdown(selectedHtml)
    const response: any = await gptPageExpand({ text: markdown, projectId: project.value.id! })

  tr.setSelection(AISelection.create(editor.state.doc, fromSec, toSec - 2))
  editor.view.dispatch(tr)
}

watch(
  () => isImageNode.value,
  (value) => {
    if (value) isImageNodeDebounced.value = value
  },
)

watchDebounced(
  () => isImageNode.value,
  (value) => {
    isImageNodeDebounced.value = value
  },
  {
    debounce: 300,
    maxWait: 600,
  },
)

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
      <template v-if="!isTableCellSelected">
        <a-button
          type="text"
          :loading="isMagicExpandLoading"
          class="menu-button !flex !flex-row !items-center"
          :class="{
            '!hover:bg-inherit !cursor-not-allowed': isMagicExpandLoading,
          }"
          :aria-active="isMagicExpandLoading"
          data-testid="nc-docs-editor-expand-button"
          @click="expandText"
        >
          <div class="flex flex-row items-center pr-0.5">
            <GeneralIcon v-if="!isMagicExpandLoading" icon="magic" class="text-orange-400 h-3.5" />
            <div class="!ml-1">Ask AI</div>
          </div>
        </a-button>
        <div class="divider"></div>
      </template>
    <div v-if="showMenuDebounced" class="bubble-menu flex flex-row gap-x-1 py-1 rounded-lg px-1">
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
      <template v-if="!isTableCellSelected">
        <a-button
          type="text"
          :class="{ 'is-active': isCheckboxActive }"
          :aria-active="isCheckboxActive"
          class="menu-button"
          data-testid="nc-docs-editor-task-button"
          @click="editor!.chain().focus().toggleTask().run()"
        >
          <MdiFormatListCheckbox />
        </a-button>
        <a-button
          type="text"
          :class="{ 'is-active': isBulletActive }"
          :aria-active="isBulletActive"
          class="menu-button"
          data-testid="nc-docs-editor-bullet-button"
          @click="editor!.chain().focus().toggleBullet().run()"
        >
          <MdiFormatBulletList />
        </a-button>
        <a-button
          type="text"
          :class="{ 'is-active': isOrderedActive }"
          :aria-active="isOrderedActive"
          class="menu-button"
          data-testid="nc-docs-editor-ordered-button"
          @click="editor!.chain().focus().toggleOrdered().run()"
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

        <div class="divider"></div>
      </template>

      <a-dropdown class="flex">
        <div class="flex flex-row items-center cursor-pointer menu-button rounded-md px-0.5">
          <MdiFormatTextVariant class="!h-4.5 !w-4.5" />
          <MaterialSymbolsKeyboardArrowDownRounded class="!h-3 !w-3" />
        </div>
        <template #overlay>
          <div v-if="showMenuDebounced" class="bubble-menu mt-1 flex flex-col rounded-md p-1 gap-y-1 w-40">
            <div class="flex my-1 ml-2 text-xs text-gray-600">Color</div>
            <div class="flex bubble-text-format-button" @click="editor!.chain().focus().unsetColor().run()">
              <div class="bubble-text-format-button-icon">A</div>
              Default
            </div>
            <div class="flex bubble-text-format-button" @click="editor!.chain().focus().setColor(tiptapTextColor.gray).run()">
              <div class="bubble-text-format-button-icon" :style="{ color: tiptapTextColor.gray }">A</div>
              Gray
            </div>
            <div class="flex bubble-text-format-button" @click="editor!.chain().focus().setColor(tiptapTextColor.brown).run()">
              <div class="bubble-text-format-button-icon" :style="{ color: tiptapTextColor.brown }">A</div>
              Brown
            </div>
            <div class="flex bubble-text-format-button" @click="editor!.chain().focus().setColor(tiptapTextColor.orange).run()">
              <div class="bubble-text-format-button-icon" :style="{ color: tiptapTextColor.orange }">A</div>
              Orange
            </div>
            <div class="flex bubble-text-format-button" @click="editor!.chain().focus().setColor(tiptapTextColor.yellow).run()">
              <div class="bubble-text-format-button-icon" :style="{ color: tiptapTextColor.yellow }">A</div>
              Yellow
            </div>
            <div class="flex bubble-text-format-button" @click="editor!.chain().focus().setColor(tiptapTextColor.green).run()">
              <div class="bubble-text-format-button-icon" :style="{ color: tiptapTextColor.green }">A</div>
              Green
            </div>
            <div class="flex bubble-text-format-button" @click="editor!.chain().focus().setColor(tiptapTextColor.blue).run()">
              <div class="bubble-text-format-button-icon" :style="{ color: tiptapTextColor.blue }">A</div>
              Blue
            </div>
            <div class="flex bubble-text-format-button" @click="editor!.chain().focus().setColor(tiptapTextColor.purple).run()">
              <div class="bubble-text-format-button-icon" :style="{ color: tiptapTextColor.purple }">A</div>
              Purple
            </div>
            <div class="flex bubble-text-format-button" @click="editor!.chain().focus().setColor(tiptapTextColor.pink).run()">
              <div class="bubble-text-format-button-icon" :style="{ color: tiptapTextColor.pink }">A</div>
              Pink
            </div>
            <div class="flex bubble-text-format-button" @click="editor!.chain().focus().setColor(tiptapTextColor.red).run()">
              <div class="bubble-text-format-button-icon" :style="{ color: tiptapTextColor.red }">A</div>
              Red
            </div>
          </div>
        </template>
      </a-dropdown>

      <template v-if="!isTableCellSelected && !parentIsTableCell && !parentIsCallout">
        <div class="divider"></div>

        <a-button
          type="text"
          :loading="isMagicExpandLoading"
          class="menu-button !flex !flex-row !items-center"
          :class="{
            '!hover:bg-inherit !cursor-not-allowed': isMagicExpandLoading,
          }"
          :aria-active="isMagicExpandLoading"
          data-testid="nc-docs-editor-expand-button"
          @click="expandText"
        >
          <div class="flex flex-row items-center pr-0.5">
            <GeneralIcon v-if="!isMagicExpandLoading" icon="magic" class="text-orange-400 h-3.5" />
            <div class="!text-xs !ml-1">Expand</div>
          </div>
        </a-button>
      </template>
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
