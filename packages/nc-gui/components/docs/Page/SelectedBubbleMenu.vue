<script lang="ts" setup>
import { defineProps } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3'
import { generateHTML, generateJSON } from '@tiptap/html'
import showdown from 'showdown'
import type { Mark } from 'prosemirror-model'
import MdiFormatBulletList from '~icons/mdi/format-list-bulleted'
import MdiFormatStrikeThrough from '~icons/mdi/format-strikethrough'
import MdiFormatListNumber from '~icons/mdi/format-list-numbered'
import MdiFormatListCheckbox from '~icons/mdi/format-list-checkbox'

const { editor } = defineProps<Props>()

const { project } = storeToRefs(useProject())

const { magicExpand } = useDocStore()

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
  if (isMagicExpandLoading.value) return

  isMagicExpandLoading.value = true
  try {
    const selectedContent = editor?.state?.selection?.content().content.toJSON()
    const selectedHtml = generateHTML({ type: 'doc', content: selectedContent }, editor.extensionManager.extensions)

    const converter = new showdown.Converter()
    converter.setOption('noHeaderId', true)

    const markdown = converter.makeMarkdown(selectedHtml)
    const response: any = await magicExpand({ text: markdown, projectId: project.value.id! })

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
</script>

<template>
  <BubbleMenu :editor="editor" :update-delay="300" :tippy-options="{ duration: 100, maxWidth: 600 }">
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
      <a-button
        type="text"
        :class="{ 'is-active': editor.isActive('strike') }"
        class="menu-button"
        @click="editor!.chain().focus().toggleStrike().run()"
      >
        <MdiFormatStrikeThrough />
      </a-button>
      <div class="divider"></div>
      <a-button
        type="text"
        :class="{ 'is-active': isCheckboxActive }"
        class="menu-button"
        @click="editor!.chain().focus().toggleTask().run()"
      >
        <MdiFormatListCheckbox />
      </a-button>
      <a-button
        type="text"
        :class="{ 'is-active': isBulletActive }"
        class="menu-button"
        @click="editor!.chain().focus().toggleBullet().run()"
      >
        <MdiFormatBulletList />
      </a-button>
      <a-button
        type="text"
        :class="{ 'is-active': isOrderedActive }"
        class="menu-button"
        @click="editor!.chain().focus().toggleOrdered().run()"
      >
        <MdiFormatListNumber />
      </a-button>
      <div class="divider"></div>

      <a-button type="text" :class="{ 'is-active': editor.isActive('link') }" class="menu-button" @click="onToggleLink">
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
    @apply border-1;
    border-color: rgb(216, 216, 216);
    background-color: #dddddd !important;
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
