<script lang="ts" setup>
import { h } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import { BubbleMenu, generateHTML } from '@tiptap/vue-3'
import { Slice } from 'prosemirror-model'
import { generateJSON } from '@tiptap/html'
import showdown from 'showdown'
import { LoadingOutlined } from '@ant-design/icons-vue'
import { undo } from 'prosemirror-history'
import { AISelection } from '@/helpers/tiptapExtensions/AISelection'

interface Props {
  editor: Editor
}
const { editor } = defineProps<Props>()

const converter = new showdown.Converter()
converter.setOption('noHeaderId', true)

const indicator = h(LoadingOutlined, {
  style: {
    fontSize: '20px',
  },
  spin: true,
})

const state = useGlobal()

const { base } = storeToRefs(useBase())
const { openedPage } = storeToRefs(useDocStore())

const inputRef = ref<HTMLInputElement>()
const searchText = ref('')
const isAIOptionsVisible = ref(false)
const isLoading = ref(false)
const drafts = ref<any[]>([])
const draftActiveIndex = ref(0)
const isSelectionEmpty = ref(false)
const suggestedMarkdown = ref('')
const pageContentWidth = ref(0)
const lastFrom = ref(0)

const checkIsAIOptionVisible = (editor: Editor) => {
  const selection = editor.state.selection
  if (!(selection instanceof AISelection)) {
    drafts.value = []

    return false
  }

  isSelectionEmpty.value = selection.empty

  updatePageContentWidth()
  setTimeout(() => {
    isAIOptionsVisible.value = true
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

async function updatePageContentWidth() {
  const dom = document.querySelector('.ProseMirror')

  pageContentWidth.value = Number(dom!.clientWidth)
}

async function streamExpand(selectionMd: string | undefined) {
  const response = await fetch(
    `${state.appInfo.value.ncSiteUrl}/api/v1/docs/base/${base.value!.id!}/page/${openedPage.value!.id}/magic-expand`,
    {
      method: 'POST',
      headers: {
        'xc-auth': state.token.value!,
      },
      body: JSON.stringify({
        promptText: searchText.value,
        ...(selectionMd ? { selectedPageText: selectionMd } : {}),
      }),
    },
  )

  if (response.ok && response.body) {
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()

    const readStream: any = () =>
      reader.read().then(({ value, done }) => {
        if (done) {
          reader.cancel()
          return Promise.resolve()
        }

        // parse the data
        const data = /{.*}/.exec(value)
        if (!data || !data[0]) {
          return readStream()
        }

        const res = JSON.parse(data[0])

        if (res?.choices?.[0]?.text) {
          suggestedMarkdown.value = suggestedMarkdown.value + res.choices[0].text
        }

        return readStream()
      })
    return readStream()
  } else {
    return Promise.reject(response)
  }
}

const expandText = async () => {
  if (isLoading.value) return

  isLoading.value = true

  const selection = editor.state.selection
  lastFrom.value = selection.from - 2

  let selectionMd
  if (!selection.empty) {
    drafts.value.push(selection.content().toJSON())
    draftActiveIndex.value = drafts.value.length - 1

    const selectionHtml = generateHTML({ type: 'doc', ...selection.content().toJSON() }, editor.extensionManager.extensions)
    const htmlWithSectionTagRemoved = selectionHtml.replace(/<section.*?>|<\/section>/g, '')
    selectionMd = converter.makeMarkdown(htmlWithSectionTagRemoved)

    const tr = editor.state.tr
    const slice = Slice.fromJSON(editor.state.schema, {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
        },
      ],
    })
    tr.replace(selection.from, selection.to, slice)
    tr.setSelection(AISelection.create(tr.doc, selection.from, selection.from + 2))

    editor.view.dispatch(tr)
  }

  try {
    suggestedMarkdown.value = ''
    await streamExpand(selectionMd)

    const html = converter.makeHtml(suggestedMarkdown.value).replace('>\n<', '><')
    const json = generateJSON(html, editor.extensionManager.extensions)

    drafts.value.push(json)
    draftActiveIndex.value = drafts.value.length - 1
    searchText.value = ''
  } finally {
    isLoading.value = false
  }
}

const onInputBoxEnter = () => {
  if (!searchText.value) return

  expandText()
}

function renderContent(json: any) {
  const state = editor.state
  const slice = Slice.fromJSON(state.schema, json)
  const tr = state.tr

  undo(state)

  tr.replaceSelection(slice)

  setTimeout(() => {
    const tr = editor.state.tr
    const newFrom = lastFrom.value

    tr.setSelection(AISelection.create(tr.doc, newFrom, newFrom + slice.size + 2))
    editor.view.dispatch(tr)

    scrollToSelectionEnd(newFrom + slice.size)
  }, 0)

  editor.view.dispatch(tr)
}

function scrollToSelectionEnd(to: number) {
  setTimeout(() => {
    const sectionDoms = document.querySelectorAll('.ProseMirror .draggable-block-wrapper')
    for (let i = 0; i < sectionDoms.length; i++) {
      const pos = Number(sectionDoms[i].getAttribute('pos'))
      if (to <= pos) {
        sectionDoms[i].scrollIntoView({ behavior: 'smooth', block: 'center' })
        break
      }
    }
  }, 100)
}

const goBackInDraft = () => {
  draftActiveIndex.value = draftActiveIndex.value - 1 < 0 ? 0 : draftActiveIndex.value - 1

  renderContent(drafts.value[draftActiveIndex.value])
}

const goForwardInDraft = () => {
  draftActiveIndex.value =
    draftActiveIndex.value + 1 > drafts.value.length - 1 ? drafts.value.length - 1 : draftActiveIndex.value + 1

  renderContent(drafts.value[draftActiveIndex.value])
}

watchDebounced(
  suggestedMarkdown,
  () => {
    const html = converter.makeHtml(suggestedMarkdown.value).replace('>\n<', '><')
    const json = generateJSON(html, editor.extensionManager.extensions)

    renderContent(json)
  },
  {
    debounce: 100,
  },
)
</script>

<template>
  <BubbleMenu
    :editor="editor"
    :tippy-options="{ delay: 0, duration: 0, placement: 'bottom-start' }"
    :should-show="(checkIsAIOptionVisible as any)"
  >
    <div
      class="relative docs-ai-options flex flex-col bg-gray-50 border-gray-100 border-1 shadow-sm w-full rounded-lg px-3 py-1"
      :style="{
        width: `${pageContentWidth}px`,
      }"
      :class="{
        '-mt-1.5 ml-6': !isSelectionEmpty,
        '-ml-1 -mt-10': isSelectionEmpty,
      }"
      data-testid="nc-docs-ai-options"
      @keydown="handleKeyDown"
      @mousedown.stop
    >
      <div class="flex flex-row items-center gap-x-1.5 !z-10 items-center">
        <div v-if="!isLoading" class="select-none">✨</div>
        <a-spin v-else class="flex" :indicator="indicator" />
        <div v-if="isLoading" class="flex py-1.5 ml-1.5">AI is writing...</div>
        <a-input
          v-else
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
        <div v-if="drafts.length > 1" class="flex text-xs text-gray-400 items-center space-x-1 select-none">
          <MdiArrowLeft class="hover:bg-gray-100 h-5 w-5 p-0.5 rounded-sm cursor-pointer" @click="goBackInDraft" />
          <div class="flex">{{ draftActiveIndex + 1 }} / {{ drafts.length }}</div>
          <MdiArrowRight class="hover:bg-gray-100 h-5 w-5 p-0.5 rounded-sm cursor-pointer" @click="goForwardInDraft" />
        </div>
      </div>
    </div>
  </BubbleMenu>
</template>

<style lang="scss"></style>
