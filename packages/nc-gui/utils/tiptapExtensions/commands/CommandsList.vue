<script setup lang="ts">
import type { Editor, Range } from '@tiptap/vue-3'
import showdown from 'showdown'
import { generateJSON } from '@tiptap/html'
import { createTable } from '@tiptap/extension-table'
import { TextSelection } from 'prosemirror-state'
import { gSuiteUrlToEmbedUrl, youtubeUrlToEmbedUrl } from './urlHelper'
import GoogleSheetsIcon from './icons/GoogleSheets.vue'
import GoogleDocsIcon from './icons/GoogleDocs.vue'
import GoogleSlidesIcon from './icons/GoogleSlides.vue'
import MdiFormatHeader1 from '~icons/mdi/format-header-1'
import MdiFormatHeader2 from '~icons/mdi/format-header-2'
import MdiFormatHeader3 from '~icons/mdi/format-header-3'
import MdiBulletList from '~icons/mdi/format-list-bulleted'
import MdiNumberedList from '~icons/mdi/format-list-numbered'
import MdiTaskList from '~icons/mdi/format-list-checks'
import MdiMinus from '~icons/mdi/minus'
import MdiCodeSnippet from '~icons/mdi/code-braces'
import MdiImageMultipleOutline from '~icons/mdi/image-multiple-outline'
import MdiFormatColorText from '~icons/mdi/format-color-text'
import PhSparkleFill from '~icons/ph/sparkle-fill'
import MdiFormatQuoteOpen from '~icons/mdi/format-quote-open'
import IcOutlineInfo from '~icons/ic/outline-info'
import IcOutlineCode from '~icons/ic/outline-code'
import IcRoundStar from '~icons/ic/round-star-outline'
import IcRoundWarning from '~icons/ph/warning-circle-bold'
import MdiTable from '~icons/mdi/table'
import LogosYoutubeIcon from '~icons/logos/youtube-icon'

interface Props {
  command: Function
  editor: Editor
  query: string
}

const { command, query, editor } = defineProps<Props>()

const { magicOutline, openedPage } = useDocs()

const isLinkInputFormState = ref(false)
const isLinkInputFormErrored = ref(false)
const isLinkInputFormType = ref('')
const linkInputRef = ref()
const linkUrl = ref('')
const fileInput = ref()
const loadingOperationName = ref('')

const onFilePicked = (event: any) => {
  const files = event.target.files
  const file = files[0]

  ;(editor.chain().focus() as any).setImage({ src: file, clearCurrentNode: true }).run()
}

const insertLink = () => {
  isLinkInputFormErrored.value = false
  // validate link
  if (!isValidURL(linkUrl.value)) {
    isLinkInputFormErrored.value = true
    return
  }

  const url = new URL(linkUrl.value)
  if (
    isLinkInputFormType.value === 'youtube' &&
    !(url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com' || url.hostname === 'youtu.be')
  ) {
    isLinkInputFormErrored.value = true
    return
  }

  if (isLinkInputFormType.value === 'youtube') {
    linkUrl.value = youtubeUrlToEmbedUrl(linkUrl.value)
  }

  if (isLinkInputFormType.value.startsWith('google')) {
    linkUrl.value = gSuiteUrlToEmbedUrl(linkUrl.value, isLinkInputFormType.value)!
  }

  editor.chain().focus().setExternalContent({
    url: linkUrl.value,
    type: isLinkInputFormType.value,
  })
  isLinkInputFormState.value = false
}

const items = [
  {
    title: 'Heading 1',
    class: 'text-xs',
    style: 'font-weight: 800;',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
    },
    icon: MdiFormatHeader1,
    iconClass: 'pt-0.5',
  },
  {
    title: 'Heading 2',
    class: 'text-xs',
    style: 'font-weight: 700;',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
    },
    icon: MdiFormatHeader2,
    iconClass: 'pt-0.5',
  },
  {
    title: 'Heading 3',
    class: 'text-xs',
    style: 'font-weight: 500;',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run()
    },
    icon: MdiFormatHeader3,
    iconClass: 'pt-0.5',
    hasDivider: true,
  },
  {
    title: 'Body Text',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      editor.chain().focus().deleteRange(range).setNode('paragraph', { level: 2 }).run()
    },
    icon: MdiFormatColorText,
    iconClass: '',
  },
  {
    title: 'Quote',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      editor.chain().focus().deleteRange(range).setNode('blockquote').run()
    },
    icon: MdiFormatQuoteOpen,
    iconClass: '',
  },
  {
    title: 'Image',
    class: 'text-xs',
    command: () => {
      fileInput.value?.[0]?.click()
    },
    icon: MdiImageMultipleOutline,
    iconClass: '',
  },
  {
    title: 'Code snippet',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      editor.chain().focus().deleteRange(range).setNode('codeBlock').run()
      // ;(editor.chain().focus() as any).toggleCodeBlock().run()
    },
    icon: MdiCodeSnippet,
    iconClass: '',
    hasDivider: true,
  },
  {
    title: 'Bullet List',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      editor.chain().focus().deleteRange(range).setNode('bulletList').run()
      ;(editor.chain().focus() as any).toggleBulletList().run()
    },
    icon: MdiBulletList,
    iconClass: '',
  },
  {
    title: 'Numbered List',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      editor.chain().focus().deleteRange(range).setNode('orderedList').run()
      ;(editor.chain().focus() as any).toggleOrderedList().run()
    },
    icon: MdiNumberedList,
    iconClass: '',
  },
  {
    title: 'Task list',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      editor.chain().focus().deleteRange(range).setNode('taskList').run()
      ;(editor.chain().focus() as any).toggleTaskList().run()
    },
    icon: MdiTaskList,
    iconClass: '',
    hasDivider: true,
  },
  {
    title: 'Info notice',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      editor.chain().focus().deleteRange(range).setNode('infoCallout').run()
    },
    icon: IcOutlineInfo,
    iconClass: '',
  },
  {
    title: 'Tip notice',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      editor.chain().focus().deleteRange(range).setNode('tipCallout').run()
    },
    icon: IcRoundStar,
    iconClass: '',
  },
  {
    title: 'Warning notice',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      editor.chain().focus().deleteRange(range).setNode('warningCallout').run()
    },
    icon: IcRoundWarning,
    iconClass: '',
    hasDivider: true,
  },
  {
    title: 'Table',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      editor.chain().focus().deleteRange(range).run()
      const node = createTable(editor.schema, 3, 3, true)
      const tr = editor.state.tr

      const offset = tr.selection.anchor + 1
      tr.replaceWith(tr.selection.anchor - 1, tr.selection.anchor, node)
        .scrollIntoView()
        .setSelection(TextSelection.near(tr.doc.resolve(offset)))

      editor.view.dispatch(tr)
    },
    icon: MdiTable,
    iconClass: '',
  },
  {
    title: 'Divider',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      ;(editor.chain().focus().deleteRange(range).setNode('horizontalRule').focus() as any).setHorizontalRule().run()
    },
    icon: MdiMinus,
    iconClass: '',
    hasDivider: true,
  },
  {
    title: 'Google Docs',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      isLinkInputFormType.value = 'googleDoc'
      isLinkInputFormState.value = true
    },
    icon: GoogleDocsIcon,
    iconClass: '',
  },
  {
    title: 'Google Sheet',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      isLinkInputFormType.value = 'googleSheet'
      isLinkInputFormState.value = true
    },
    icon: GoogleSheetsIcon,
    iconClass: '',
  },
  {
    title: 'Google Slide',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      isLinkInputFormType.value = 'googleSlide'
      isLinkInputFormState.value = true
    },
    icon: GoogleSlidesIcon,
    iconClass: '',
  },
  {
    title: 'Youtube',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      isLinkInputFormType.value = 'youtube'
      isLinkInputFormState.value = true
    },
    icon: LogosYoutubeIcon,
    iconClass: '',
  },
  {
    title: 'Embed iframe',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      isLinkInputFormType.value = 'externalContent'
      isLinkInputFormState.value = true
    },
    icon: IcOutlineCode,
    iconClass: '',
    hasDivider: true,
  },
  {
    title: 'Outline page',
    class: 'text-xs',
    command: ({ editor }: { editor: Editor }) => {
      outlinePage(editor)
    },
    icon: PhSparkleFill,
    iconClass: 'text-orange-400 h-3.5',
  },
]

const filterItems = computed(() => {
  return items.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()))
})

const selectedIndex = ref(0)

const selectItem = (title: string) => {
  const index = items.findIndex((item) => item.title === title)
  command(items[index])
}

const scrollToSelectedNode = () => {
  const dom = document.querySelector(`.items .item:nth-child(${selectedIndex.value + 1})`)
  const wrapperDom = document.querySelector(`.items`)

  const dividerCount =
    filterItems.value.length === items.length
      ? filterItems.value.slice(0, selectedIndex.value).filter((item) => item.hasDivider).length
      : 0

  const remInPixels = Number(getComputedStyle(document.documentElement).fontSize.replace('px', ''))

  if (dom && wrapperDom) {
    // todo: Hack. Find a better way to calculate the offset
    wrapperDom.scrollTop =
      dom.offsetTop -
      wrapperDom.offsetHeight +
      (dom.clientHeight - remInPixels) * selectedIndex.value +
      (remInPixels / 4) * dividerCount
  }
}

const upHandler = () => {
  selectedIndex.value = (selectedIndex.value + items.length - 1) % items.length
  scrollToSelectedNode()
}

const downHandler = () => {
  selectedIndex.value = (selectedIndex.value + 1) % items.length
  scrollToSelectedNode()
}

const onHover = (index: number) => {
  selectedIndex.value = index
}

const enterHandler = () => {
  const item = filterItems.value[selectedIndex.value]
  selectItem(item.title)
}

function onKeyDown({ event }: { event: KeyboardEvent }) {
  if (event.key === 'ArrowUp') {
    upHandler()
    return true
  }

  if (event.key === 'ArrowDown') {
    downHandler()
    return true
  }

  if (event.key === 'Enter') {
    enterHandler()
    return true
  }

  return false
}

async function outlinePage(editor: Editor) {
  if (loadingOperationName.value) return

  loadingOperationName.value = 'Outline page'
  try {
    const converter = new showdown.Converter()
    converter.setOption('noHeaderId', true)

    const response: any = await magicOutline()

    const html = converter.makeHtml(response.text).replace('>\n<', '><')
    const tiptapNewNodeJSON = generateJSON(html, editor.extensionManager.extensions)

    const transaction = editor?.state.tr
    for (const node of tiptapNewNodeJSON.content.reverse()) {
      if (node?.content?.[0]?.text === openedPage.value?.title) {
        continue
      }

      const proseNode = editor.schema.nodeFromJSON(node)
      transaction.insert(0, proseNode)
    }
    editor?.view.dispatch(transaction)
  } finally {
    loadingOperationName.value = ''
  }
}

watch(
  () => query,
  () => {
    selectedIndex.value = 0
  },
)

watch(linkInputRef, (value) => {
  if (value) {
    value.focus()
  }
})

watch(linkUrl, () => {
  isLinkInputFormErrored.value = false
})

watch(isLinkInputFormState, () => {
  if (!isLinkInputFormState.value) {
    linkUrl.value = ''
    isLinkInputFormErrored.value = false
  }
})

defineExpose({
  onKeyDown,
})
</script>

<template>
  <div class="items">
    <template v-if="isLinkInputFormState">
      <div class="flex flex-col w-44 mx-1 mt-1 mb-1">
        <div class="w-6 rounded-md my-1 p-1 cursor-pointer hover:bg-gray-200" @click="isLinkInputFormState = false">
          <MdiArrowLeft />
        </div>
        <input
          ref="linkInputRef"
          v-model="linkUrl"
          class="w-full my-1 py-1 px-2 border-0 bg-gray-100 text-sm rounded-md focus:outline-none !focus:shadow-none !focus:ring-warmGray-50"
          type="text"
          placeholder="Enter link"
          @keydown.enter="insertLink"
        />
        <div v-if="isLinkInputFormErrored" class="flex flex-row pl-1.5 pr-1 pb-1 text-xs text-red-500">
          Given
          <span v-if="isLinkInputFormType !== 'externalContent'" class="capitalize px-1">{{ isLinkInputFormType }}</span>
          link is not valid
        </div>
      </div>
    </template>
    <template v-else-if="filterItems.length">
      <template v-for="(item, index) in filterItems" :key="item.title">
        <a-button
          class="item !flex !flex-row !items-center"
          :class="{
            'is-selected': index === selectedIndex,
            '!hover:bg-inherit !cursor-not-allowed': loadingOperationName === item.title,
          }"
          type="text"
          :loading="loadingOperationName === item.title"
          @click="selectItem(item.title)"
          @mouseenter="() => onHover(index)"
        >
          <input
            v-if="item.title === 'Image'"
            ref="fileInput"
            type="file"
            style="display: none"
            accept="image/*"
            @change="onFilePicked"
          />
          <div class="flex flex-row items-center gap-x-1.5">
            <component :is="item.icon" v-if="item.icon && loadingOperationName !== item.title" :class="item.iconClass" />
            <div :class="item.class" :style="item.style">
              {{ item.title }}
            </div>
          </div>
        </a-button>
        <div v-if="item.hasDivider && filterItems.length === items.length" class="divider"></div>
      </template>
    </template>
    <div v-else class="item">No result</div>
  </div>
</template>

<style lang="scss" scoped>
.items {
  @apply px-1 my-0.5 w-48;
  position: relative;
  border-radius: 0.5rem;
  color: rgba(0, 0, 0, 0.8);
  overflow: hidden;
  font-size: 0.9rem;
  @apply bg-gray-50;
  max-height: 16rem;
  overflow-y: overlay;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05), 0px 1px 1px rgba(0, 0, 0, 0.1);
}

.divider {
  width: 90%;
  @apply border-t border-gray-200 ml-1.5 !my-2;
}

.item {
  display: block;
  margin: 0;
  width: 100%;
  text-align: left;
  background: transparent;
  border-radius: 0.4rem;
  border: 1px solid transparent;
  padding: 0.3rem 0.75rem;
  margin: 0.2rem 0;
  @apply !transition-none;

  &.is-selected {
    @apply border-gray-200 !bg-gray-100;
  }
}

.items {
  // scrollbar reduce width and gray color
  &::-webkit-scrollbar {
    width: 2px;
  }

  /* Track */
  &::-webkit-scrollbar-track {
    @apply my-2;
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
