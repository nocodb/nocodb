<script lang="ts" setup>
import { defineProps } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3'
import { generateHTML, generateJSON } from '@tiptap/html'
import showdown from 'showdown'
import MdiFormatBulletList from '~icons/mdi/format-list-bulleted'
import MdiFormatStrikeThrough from '~icons/mdi/format-strikethrough'

const { editor } = defineProps<Props>()

const { magicExpand } = useDocs()

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

// Debounce show menu to prevent flickering
const showMenu = computed(() => {
  const isNonSelectableNodesSelected =
    isImageNodeDebounced.value ||
    (editor?.isActive('table') && !editor?.isActive('tableCell') && !editor?.isActive('tableHeader'))
  return editor?.state?.selection.visible && !isNonSelectableNodesSelected
})
const showMenuDebounced = ref(false)

const expandText = async () => {
  if (isMagicExpandLoading.value) return

  isMagicExpandLoading.value = true
  try {
    const selectedContent = editor?.state?.selection?.content().content.toJSON()
    const selectedHtml = generateHTML({ type: 'doc', content: selectedContent }, editor.extensionManager.extensions)

    const converter = new showdown.Converter()
    converter.setOption('noHeaderId', true)

    const markdown = converter.makeMarkdown(selectedHtml)
    const response: any = await magicExpand(markdown)

    editor
      ?.chain()
      .deleteRange({
        from: editor.state.selection.from,
        to: editor.state.selection.to,
      })
      .run()

    const html = converter.makeHtml(response.text).replace('>\n<', '><')
    const tiptapNewNodeJSON = generateJSON(html, editor.extensionManager.extensions)

    for (const node of tiptapNewNodeJSON.content) {
      const proseNode = editor.schema.nodeFromJSON(node)
      const transaction = editor?.state.tr.insert(editor.state.selection.from - 1, proseNode)
      editor?.view.dispatch(transaction)
    }
  } finally {
    isMagicExpandLoading.value = false
  }
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
</script>

<template>
  <BubbleMenu :editor="editor" :tippy-options="{ duration: 100, maxWidth: 600 }">
    <div v-if="showMenuDebounced" class="bubble-menu flex flex-row gap-x-1 bg-gray-100 py-1 rounded-lg px-1">
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
        @click=";(editor!.chain().focus() as any).toggleItalic().run()"
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
        @click="
          editor!
            .chain()
            .focus()
            .toggleLink({
              href: '',
            })
            .selectTextblockEnd()
            .run()
        "
      >
        <div class="flex flex-row items-center px-0.5">
          <MdiLink />
          <div class="!text-xs !ml-1">Link</div>
        </div>
      </a-button>

      <div class="divider"></div>

      <a-button
        type="text"
        :loading="isMagicExpandLoading"
        class="menu-button !flex !flex-row !items-center"
        :class="{
          '!hover:bg-inherit !cursor-not-allowed': isMagicExpandLoading,
        }"
        @click="expandText"
      >
        <div class="flex flex-row items-center pr-0.5">
          <PhSparkleFill v-if="!isMagicExpandLoading" class="text-orange-400 h-3.5" />
          <div class="!text-xs !ml-1">Expand</div>
        </div>
      </a-button>
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
