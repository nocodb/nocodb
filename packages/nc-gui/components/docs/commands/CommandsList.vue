<script setup lang="ts">
import type { Editor, Range } from '@tiptap/vue-3'
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

interface Props {
  command: Function
  editor: Editor
  query: string
}

const { command, query, editor } = defineProps<Props>()

const fileInput = ref()
const onFilePicked = (event: any) => {
  const files = event.target.files
  const file = files[0]

  ;(editor.chain().focus() as any).setImage({ src: file, clearCurrentNode: true }).run()
}

const items = [
  {
    title: 'Heading 1',
    style: 'font-size: 1rem; font-weight: 500; margin-left: -0.3rem;',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
    },
    icon: MdiFormatHeader1,
    iconClass: 'text-lg',
  },
  {
    title: 'Heading 2',
    style: 'font-size: 0.85rem; font-weight: 450; margin-left: -0.15rem;',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
    },
    icon: MdiFormatHeader2,
    iconClass: 'text-base',
  },
  {
    title: 'Heading 3',
    class: 'text-xs',
    style: 'font-weight: 450;',
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run()
    },
    icon: MdiFormatHeader3,
    iconClass: '',
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
  },
]

const filterItems = computed(() => {
  return items.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()))
})

const selectedIndex = ref(0)

const selectItem = (index: number) => {
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
  selectItem(selectedIndex.value)
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
      <template v-for="(item, index) in filterItems" :key="index">
        <button
          class="item"
          :class="{ 'is-selected': index === selectedIndex }"
          @click="selectItem(index)"
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
            <component :is="item.icon" v-if="item.icon" :class="item.iconClass" />
            <div :class="item.class" :style="item.style">
              {{ item.title }}
            </div>
          </div>
        </button>
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
  background: #fff;
  color: rgba(0, 0, 0, 0.8);
  overflow: hidden;
  font-size: 0.9rem;
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
    @apply border-gray-100 !bg-gray-50;
  }
}
</style>
