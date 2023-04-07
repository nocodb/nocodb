<script setup lang="ts">
import type { Editor, Range } from '@tiptap/vue-3'
import { isMacOS } from '@tiptap/vue-3'
import showdown from 'showdown'
import { generateJSON } from '@tiptap/html'
import { createTable } from '@tiptap/extension-table'
import { TextSelection } from 'prosemirror-state'
import GoogleSheetsIcon from './custom-icons/GoogleSheets.vue'
import GoogleDocsIcon from './custom-icons/GoogleDocs.vue'
import GoogleSlidesIcon from './custom-icons/GoogleSlides.vue'
import ClickupIcon from './custom-icons/Clickup.vue'
import MiroIcon from './custom-icons/Miro.vue'
import { getExternalContentType } from '~/utils/tiptapExtensions/external-content/urlHelper'
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
import LogosGithubIcon from '~icons/logos/github-icon'
import LogosFigmaIcon from '~icons/logos/figma'
import LogosAirtableIcon from '~icons/logos/airtable'
import LogosCodepenIcon from '~icons/logos/codepen-icon'
import LogosTrelloIcon from '~icons/logos/trello'
import LogosTypeformIcon from '~icons/logos/typeform-icon'
import MdiLinkVariant from '~icons/mdi/link-variant'

interface Props {
  command: Function
  editor: Editor
  query: string
}

const { command, query, editor } = defineProps<Props>()

const { openedPage, openedProjectId } = storeToRefs(useDocStore())
const { magicOutline } = useDocStore()

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

  ;(editor.chain().focus() as any).setImage({ src: file }).run()
}

const insertLink = () => {
  isLinkInputFormErrored.value = false
  // validate link
  if (!isValidURL(linkUrl.value)) {
    isLinkInputFormErrored.value = true
    return
  }

  if (isLinkInputFormType.value !== 'externalContent' && getExternalContentType(linkUrl.value) !== isLinkInputFormType.value) {
    isLinkInputFormErrored.value = true
    return
  }

  editor
    .chain()
    .focus()
    .setExternalContent({
      url: urlToEmbedUrl(linkUrl.value),
      type: getExternalContentType(isLinkInputFormType.value)!,
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
    shortCutText: isMacOS() ? '^ ⇧ 1' : 'Ctrl ⇧ 1',
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
    shortCutText: isMacOS() ? '^ ⇧ 2' : 'Ctrl ⇧ 2',
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
    shortCutText: isMacOS() ? '^ ⇧ 3' : 'Ctrl ⇧ 3',
  },
  {
    title: 'Link',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      editor.chain().focus().deleteRange(range).setLink({ href: '' }).run()
    },
    icon: MdiLinkVariant,
    shortCutText: isMacOS() ? '^ K' : 'Ctrl K',
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
      editor.chain().focus().deleteRange(range).setBlockquote().run()
    },
    icon: MdiFormatQuoteOpen,
    iconClass: '',
    shortCutText: isMacOS() ? '⌘ ]' : 'Ctrl ]',
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
    title: 'Code',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      editor.chain().focus().deleteRange(range).setNode('codeBlock').run()
      // ;(editor.chain().focus() as any).toggleCodeBlock().run()
    },
    icon: MdiCodeSnippet,
    iconClass: '',
    hasDivider: true,
    shortCutText: isMacOS() ? '⌥ ⌘ C' : 'Alt Ctrl C',
  },
  {
    title: 'Task List',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().toggleTask().run()
    },
    icon: MdiTaskList,
    iconClass: '',
    shortCutText: isMacOS() ? '^ ⌥ 1' : 'Ctrl Alt 1',
  },
  {
    title: 'Bullet List',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().toggleBullet().run()
    },
    icon: MdiBulletList,
    iconClass: '',
    // Ctrl + Option + Shift + 8
    shortCutText: isMacOS() ? '^ ⌥ 2' : 'Ctrl Alt 2',
  },
  {
    title: 'Numbered List',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      editor.chain().focus().deleteRange(range).insertOrdered().run()
    },
    icon: MdiNumberedList,
    iconClass: '',
    shortCutText: isMacOS() ? '^ ⌥ 3' : 'Ctrl Alt 3',
    hasDivider: true,
  },

  {
    title: 'Info notice',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: 'infoCallout',
          content: [
            {
              type: 'paragraph',
              text: '',
            },
          ],
        })
        .run()
    },
    icon: IcOutlineInfo,
    iconClass: '',
  },
  {
    title: 'Tip notice',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: 'tipCallout',
          content: [
            {
              type: 'paragraph',
              text: '',
            },
          ],
        })
        .run()
    },
    icon: IcRoundStar,
    iconClass: '',
  },
  {
    title: 'Warning notice',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: 'warningCallout',
          content: [
            {
              type: 'paragraph',
              text: '',
            },
          ],
        })
        .run()
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
      const node = createTable(editor.schema, 3, 3, false)
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
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode('horizontalRule')
        .focus()
        .setHorizontalRule()
        .setTextSelection(range.from + 3)
        .run()
    },
    icon: MdiMinus,
    iconClass: '',
    hasDivider: true,
    shortCutText: 'Ctrl ⇧ H',
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
    title: 'Airtable',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      isLinkInputFormType.value = 'airtable'
      isLinkInputFormState.value = true
    },
    icon: LogosAirtableIcon,
    iconClass: '',
  },
  {
    title: 'Github Gist',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      isLinkInputFormType.value = 'githubGist'
      isLinkInputFormState.value = true
    },
    icon: LogosGithubIcon,
    iconClass: '',
  },
  {
    title: 'Figma',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      isLinkInputFormType.value = 'figma'
      isLinkInputFormState.value = true
    },
    icon: LogosFigmaIcon,
    iconClass: '',
  },
  {
    title: 'Clickup',
    class: 'text-xs -ml-1',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      isLinkInputFormType.value = 'clickup'
      isLinkInputFormState.value = true
    },
    icon: ClickupIcon,
    iconClass: '',
  },
  {
    title: 'Miro',
    class: 'text-xs -ml-1',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      isLinkInputFormType.value = 'miro'
      isLinkInputFormState.value = true
    },
    icon: MiroIcon,
    iconClass: '',
  },
  {
    title: 'Typeform',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      isLinkInputFormType.value = 'typeform'
      isLinkInputFormState.value = true
    },
    icon: LogosTypeformIcon,
    iconClass: '',
  },
  {
    title: 'Trello',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      isLinkInputFormType.value = 'trello'
      isLinkInputFormState.value = true
    },
    icon: LogosTrelloIcon,
    iconClass: '',
  },
  {
    title: 'Codepen',
    class: 'text-xs',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      isLinkInputFormType.value = 'codepen'
      isLinkInputFormState.value = true
    },
    icon: LogosCodepenIcon,
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

  // Delete the current line
  const { from } = editor.state.selection
  const parent = editor.state.doc.resolve(from).parent

  loadingOperationName.value = 'Outline page'
  try {
    const converter = new showdown.Converter()
    converter.setOption('noHeaderId', true)

    const response: any = await magicOutline({
      projectId: openedProjectId.value,
      pageId: openedPage.value?.id,
    })

    const html = converter
      .makeHtml(
        response.text
          .replace(/\n\n# .*?\n/g, '')
          .replace('## ', '# ')
          .replace('### ', '## '),
      )
      .replace('>\n<', '><')

    // Removed line which has :content: text
    const cleanedHtml = html.replace(/--content--/gi, '')
    const tiptapNewNodeJSON = generateJSON(cleanedHtml, editor.extensionManager.extensions)

    editor
      .chain()
      .focus()
      .setNodeSelection(from - parent.nodeSize)
      .deleteSelection()
      .run()

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
  <div class="items nc-docs-command-list">
    <template v-if="isLinkInputFormState">
      <div class="flex flex-col w-56 mx-1 mt-1 mb-1">
        <div
          class="w-8 rounded-md my-1 p-1 pl-2 cursor-pointer hover:bg-gray-200"
          data-testid="nc-docs-command-list-link-back-btn"
          @click="isLinkInputFormState = false"
        >
          <MdiArrowLeft />
        </div>
        <input
          ref="linkInputRef"
          v-model="linkUrl"
          class="w-full my-1 py-1 px-2 border-0 bg-gray-100 text-sm rounded-md focus:outline-none !focus:shadow-none !focus:ring-warmGray-50"
          type="text"
          placeholder="Enter link"
          data-testid="nc-docs-command-list-link-input"
          @keydown.enter="insertLink"
          @keydown.escape="isLinkInputFormState = false"
        />
        <div
          v-if="isLinkInputFormErrored"
          class="flex flex-row pl-1.5 pr-1 pb-1 text-xs text-red-500"
          data-testid="nc-docs-command-list-link-input-error"
        >
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
          :data-testid="`nc-docs-command-list-item-${item.title}`"
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
          <div class="flex flex-row items-center justify-between w-full">
            <div class="flex items-center gap-x-1.5">
              <component :is="item.icon" v-if="item.icon && loadingOperationName !== item.title" :class="item.iconClass" />
              <div :class="item.class" :style="item.style">
                {{ item.title }}
              </div>
            </div>
            <div class="flex text-gray-400 items-center">
              {{ item.shortCutText }}
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
  @apply px-1 my-0.5 w-60;
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
