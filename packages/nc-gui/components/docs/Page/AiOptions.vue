<script lang="ts" setup>
import type { VNode } from 'vue'
import { defineProps, h } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3'
import { TiptapNodesTypes } from 'nocodb-sdk'
import { Slice } from 'prosemirror-model'
import { generateHTML, generateJSON } from '@tiptap/html'
import showdown from 'showdown'
import { LoadingOutlined } from '@ant-design/icons-vue'
import { TextSelection } from 'prosemirror-state'

import { AISelection } from '~/utils/tiptapExtensions/AISelection'

const { editor } = defineProps<Props>()
const sampleHtml = `
<p>Overall, marketing is an essential part of any business. It is important to understand the different types of marketing strategies and find the right mix of strategies that works best for your business. By understanding your target audience and creating valuable content for them, you can create successful marketing campaigns that will help you
<h1 id="hahaha">Hahaha</h1><h2 id="marketing">Marketing</h2>
`

const indicator = h(LoadingOutlined, {
  style: {
    fontSize: '24px',
  },
  spin: true,
})

interface Props {
  editor: Editor
}

const { project } = storeToRefs(useProject())
const { magicExpand } = useDocStore()

const inputRef = ref<HTMLInputElement>()
const searchText = ref('')
const isAiOptionsVisible = ref(false)
const isLoading = ref(false)
const drafts = ref<any[]>([])
const draftActiveIndex = ref(0)
const isSelectionEmpty = ref(false)

const checkIsAiOptionVisible = (editor: Editor) => {
  const selection = editor.state.selection
  if (!(selection instanceof AISelection)) {
    // isAiOptionsVisible.value = false
    // drafts.value = []

    return false
  }

  isSelectionEmpty.value = selection.empty

  updatePageContentWidth()
  setTimeout(() => {
    isAiOptionsVisible.value = true
    inputRef.value?.focus()
  }, 0)

  return true
}

const removeAISelection = () => {
  const to = editor.state.selection.to
  editor
    .chain()
    .setTextSelection({
      from: to,
      to,
    })
    .focus()
    .run()
}

const handleKeyDown = (e: any) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    e.stopPropagation()

    if (!searchText.value) {
      removeAISelection()
    }
  }
  // Escape
  if (e.key === 'Escape') {
    e.preventDefault()
    removeAISelection()
  }

  // Backspace
  if (e.key === 'Backspace' && !searchText.value) {
    e.preventDefault()
    removeAISelection()
  }
}

const pageContentWidth = ref(0)
async function updatePageContentWidth() {
  const dom = document.querySelector('.ProseMirror')

  pageContentWidth.value = Number(dom!.clientWidth)
}

const expandText = async (getFromDrafts?: boolean) => {
  if (isLoading.value) return
  const state = editor.state
  const selection = state.selection

  isLoading.value = true
  try {
    const converter = new showdown.Converter()

    // const selectedContent = editor?.state?.selection?.content().content.toJSON()
    // const selectedHtml = generateHTML({ type: 'doc', content: selectedContent }, editor.extensionManager.extensions)

    // converter.setOption('noHeaderId', true)

    // const markdown = converter.makeMarkdown(selectedHtml)
    // const response: any = await magicExpand({ text: searchText.value, projectId: project.value.id! })

    // const html = converter.makeHtml(response.text).replace('>\n<', '><')
    const html = sampleHtml.replace('Overall', `Overall ${draftActiveIndex.value}`)
    const json = getFromDrafts ? drafts.value[draftActiveIndex.value] : generateJSON(html, editor.extensionManager.extensions)

    const slice = Slice.fromJSON(state.schema, json)
    const tr = state.tr
    const from = selection.$from.pos

    tr.replaceSelection(slice)
    const newFrom = from - 2 > 0 ? from - 2 : 0
    const newTo = tr.doc.nodeSize - 2 < selection.to + 2 ? tr.doc.nodeSize - 2 : selection.to + 2
    tr.setSelection(AISelection.create(tr.doc, newFrom, newTo))
    editor.view.dispatch(tr)

    setTimeout(() => {
      const tr = editor.state.tr

      tr.setSelection(AISelection.create(editor.state.doc, newFrom, from + slice.size + 2))

      editor.view.dispatch(tr)
      isSelectionEmpty.value = false

      if (getFromDrafts) return

      drafts.value.push(json)
      draftActiveIndex.value = drafts.value.length - 1
      searchText.value = ''
    }, 0)
  } finally {
    isLoading.value = false
  }
}

const onInputBoxEnter = () => {
  if (!searchText.value) return

  expandText()
}

const goBackInDraft = () => {
  draftActiveIndex.value = draftActiveIndex.value - 1 < 0 ? 0 : draftActiveIndex.value - 1

  expandText(true)
}

const goForwardInDraft = () => {
  draftActiveIndex.value =
    draftActiveIndex.value + 1 > drafts.value.length - 1 ? drafts.value.length - 1 : draftActiveIndex.value + 1

  expandText(true)
}
</script>

<template>
  <BubbleMenu
    :editor="editor"
    :tippy-options="{ delay: 0, duration: 0, placement: 'bottom-start' }"
    :should-show="(checkIsAiOptionVisible as any)"
  >
    <div
      class="relative docs-ai-options flex flex-col bg-gray-50 border-gray-100 border-1 shadow-sm w-full rounded-lg px-3 py-1"
      :style="{
        width: `${pageContentWidth}px`,
      }"
      :class="{
        '-mt-2.5 ml-6': !isSelectionEmpty,
        '-ml-1 -mt-10': isSelectionEmpty,
      }"
      data-testid="nc-docs-ai-options"
      @keydown="handleKeyDown"
      @mousedown.stop
    >
      <div class="flex flex-row items-center gap-x-1.5 !z-10">
        <div v-if="!isLoading" class="select-none">✨</div>
        <a-spin v-else :indicator="indicator" />
        <a-input
          ref="inputRef"
          v-model:value="searchText"
          class="docs-link-option-input flex-1 !py-1 !rounded-md z-10 !px-0"
          :style="{
            width: `${pageContentWidth}px`,
            fontSize: '1rem',
          }"
          :loading="isLoading"
          :bordered="false"
          placeholder="Ask AI to write anything"
          @press-enter="onInputBoxEnter"
        />
        <div v-if="drafts.length > 1" class="flex text-xs text-gray-400 items-center space-x-1">
          <MdiArrowLeft @click="goBackInDraft" />
          <div class="flex">{{ draftActiveIndex + 1 }} / {{ drafts.length }}</div>
          <MdiArrowRight @click="goForwardInDraft" />
        </div>
      </div>
    </div>
  </BubbleMenu>
</template>

<style lang="scss">
.docs-ai-options-drafts {
  overflow-y: overlay;
  // scrollbar reduce width and gray color
  &::-webkit-scrollbar {
    width: 4px;
  }

  /* Track */
  &::-webkit-scrollbar-track {
    background: #f6f6f600 !important;
  }

  /* Handle */
  &::-webkit-scrollbar-thumb {
    background: #f6f6f600;
  }

  /* Handle on hover */
  &::-webkit-scrollbar-thumb:hover {
    background: #f6f6f600;
  }
}
.docs-ai-options-drafts:hover {
  // scrollbar reduce width and gray color
  &::-webkit-scrollbar {
    width: 4px;
  }

  /* Track */
  &::-webkit-scrollbar-track {
    background: #f6f6f600 !important;
  }

  /* Handle */
  &::-webkit-scrollbar-thumb {
    background: rgb(215, 215, 215);
  }

  /* Handle on hover */
  &::-webkit-scrollbar-thumb:hover {
    background: rgb(203, 203, 203);
  }
}
</style>
