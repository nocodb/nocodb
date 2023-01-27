<script setup lang="ts">
import type { Editor, Range } from '@tiptap/vue-3'
import showdown from 'showdown'
import { generateJSON } from '@tiptap/html'
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

interface Props {
  command: Function
  editor: Editor
  query: string
}

const { command, query, editor } = defineProps<Props>()

const { magicOutline, openedPage } = useDocs()

const fileInput = ref()
const loadingOperationName = ref('')

const onFilePicked = (event: any) => {
  const files = event.target.files
  const file = files[0]

  ;(editor.chain().focus() as any).setImage({ src: file, clearCurrentNode: true }).run()
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

const upHandler = () => {
  selectedIndex.value = (selectedIndex.value + items.length - 1) % items.length
}

const downHandler = () => {
  selectedIndex.value = (selectedIndex.value + 1) % items.length
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

watch(items, () => {
  selectedIndex.value = 0
})

defineExpose({
  onKeyDown,
})
</script>

<template>
  <div class="items">
    <template v-if="filterItems.length">
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
        <div v-if="item.hasDivider" class="divider"></div>
      </template>
    </template>
    <div v-else class="item">No result</div>
  </div>
</template>

<style lang="scss" scoped>
.items {
  @apply px-1 py-0.5
  position: relative;
  border-radius: 0.5rem;
  color: rgba(0, 0, 0, 0.8);
  overflow: hidden;
  font-size: 0.9rem;
  @apply bg-gray-50;

  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05), 0px 10px 20px rgba(0, 0, 0, 0.1);
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

  &.is-selected {
    @apply border-gray-200 !bg-gray-100;
  }
}
</style>
