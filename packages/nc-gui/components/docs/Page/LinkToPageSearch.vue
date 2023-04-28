<script lang="ts" setup>
import { defineProps } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3'
import { TiptapNodesTypes } from 'nocodb-sdk'
import { Icon as IconifyIcon } from '@iconify/vue'
import { onClickOutside } from '@vueuse/core'

const { editor } = defineProps<Props>()

const { flattenedNestedPages, openedPage } = storeToRefs(useDocStore())

interface Props {
  editor: Editor
}

const inputRef = ref<HTMLInputElement>()
const selectedIndex = ref(0)
const searchText = ref('')
const isLinkOptionsVisible = ref(false)
const wrapperRef = ref<HTMLElement>()

// Used in Page list keyboard navigation as when we scroll with and up and dow arrow
// List moves relative to the cursor position, so we need to store the cursor position
// So we can ignore the cursor position when we scroll with the arrow keys
const cursorPos = ref({ x: 0, y: 0 })

const filteredPages = computed(() => {
  if (!searchText.value || searchText.value === '')
    return flattenedNestedPages.value.filter((page) => page.id !== openedPage.value?.id).slice(0, 10)

  const searchTextText = searchText.value.toLowerCase()

  return flattenedNestedPages.value.filter((page) => {
    return page.title.toLowerCase().includes(searchTextText) && page.id !== openedPage.value?.id
  })
})

// This function is called by LinkToPageSearch on selection change
// It is used to check if the active node is a linkToPage node with no pageId
const checkLinkToPageSearchNode = (editor: Editor) => {
  if (!editor.view.editable) {
    isLinkOptionsVisible.value = false
    return false
  }

  const selection = editor.state.selection
  const currentNode = selection.$anchor.node()
  if (currentNode.childCount === 0) {
    isLinkOptionsVisible.value = false
    return false
  }

  const linkToPageNode = currentNode.child(0)
  if (!linkToPageNode) {
    isLinkOptionsVisible.value = false
    return false
  }

  const isLinkToPageNode = linkToPageNode.type.name === TiptapNodesTypes.linkToPage
  if (!isLinkToPageNode || linkToPageNode.attrs.pageId) {
    isLinkOptionsVisible.value = false
    return false
  }

  setTimeout(() => {
    searchText.value = ''
    selectedIndex.value = 0
    isLinkOptionsVisible.value = true
    inputRef.value?.focus()
  }, 0)

  return true
}

const onChange = () => {}

const onPageClick = (page: any) => {
  const currentSectionPos = getPositionOfSection(editor.state)

  editor
    .chain()
    .setNodeSelection(currentSectionPos)
    .deleteSelection()
    .deleteActiveSection()
    .insertContentAt(editor.state.selection.from - 1, {
      type: TiptapNodesTypes.sec,
      content: [
        {
          type: TiptapNodesTypes.linkToPage,
          attrs: {
            pageId: page.id,
          },
        },
      ],
    })
    .run()
}

const removeLinkNode = () => {
  if (isLinkOptionsVisible.value) {
    isLinkOptionsVisible.value = false
    editor
      .chain()
      .focus()
      .deleteActiveSection()
      .insertContentAt(editor.state.selection.from - 1, {
        type: TiptapNodesTypes.sec,
        content: [
          {
            type: TiptapNodesTypes.paragraph,
          },
        ],
      })
      .deleteActiveSection()
      .run()
  }
}

const scrollToViewPageList = () => {
  const selectedItem = document.querySelector('.docs-link-to-page-search .page-item.selected')
  if (selectedItem) {
    selectedItem.scrollIntoView({ block: 'center' })
  }
}

const handleKeyDown = (e: any) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    e.stopPropagation()

    if (filteredPages.value.length > 0) {
      onPageClick(filteredPages.value[selectedIndex.value])
    }
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (selectedIndex.value < filteredPages.value.length - 1) {
      selectedIndex.value += 1
      scrollToViewPageList()
    }
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (selectedIndex.value > 0) {
      selectedIndex.value -= 1
      scrollToViewPageList()
    }
  }

  // Escape
  if (e.key === 'Escape') {
    e.preventDefault()
    removeLinkNode()
  }

  // Backspace
  if (e.key === 'Backspace') {
    e.preventDefault()
    removeLinkNode()
  }

  // Ctrl + Z/ Meta + Z
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault()
    editor.commands.undo()
  }

  // Ctrl + Shift + Z/ Meta + Shift + Z
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
    e.preventDefault()
    editor.commands.redo()
  }
}

const onInputBoxEnter = () => {}

const handleInputBoxKeyDown = (e: any) => {
  if ((e.key === 'ArrowDown' || e.key === 'Escape') && filteredPages.value.length === 0) {
    editor.chain().focus().run()
  }
}

watch(isLinkOptionsVisible, (value, oldValue) => {
  if (value && !oldValue) {
    const isPlaceholderEmpty =
      !editor?.state?.selection.$from.nodeBefore?.textContent && !editor?.state?.selection.$from.nodeAfter?.textContent

    if (!isPlaceholderEmpty) return

    setTimeout(() => {
      inputRef.value?.focus()
    }, 100)
  }
})

const onMouseOver = (e: any, index: number) => {
  if (cursorPos.value.x === e.clientX && cursorPos.value.y === e.clientY) return

  cursorPos.value = { x: e.clientX, y: e.clientY }
  selectedIndex.value = index
}

const pageContentWidth = computed(() => {
  const selection = editor.state.selection
  const currentNode = selection.$anchor.node()
  if (currentNode.childCount === 0) return null

  const linkToPageNode = currentNode.child(0)
  if (!linkToPageNode) return null

  const pos = selection.from
  const dom = editor.view.domAtPos(pos)
  const linkPlaceHolderDom = (dom.node as any).querySelector('.link-to-page-placeholder') as HTMLElement
  if (!linkPlaceHolderDom) return null

  return Number(linkPlaceHolderDom.clientWidth)
})

onClickOutside(wrapperRef, () => {
  removeLinkNode()
})
</script>

<template>
  <BubbleMenu
    :editor="editor"
    :tippy-options="{ delay: 0, duration: 0, placement: 'bottom-start' }"
    :should-show="(checkLinkToPageSearchNode as any)"
  >
    <div
      ref="wrapperRef"
      class="relative docs-link-to-page-search flex flex-col bg-white -mt-1 rounded-lg"
      :style="{
        width: `${pageContentWidth}px`,
      }"
      data-testid="nc-docs-link-to-page-search"
      @keydown="handleKeyDown"
    >
      <div class="rounded-md !z-10">
        <a-input
          ref="inputRef"
          v-model:value="searchText"
          class="docs-link-option-input flex-1 !py-1 !rounded-md z-10 !px-0"
          :style="{
            width: `${pageContentWidth}px`,
            fontSize: '1rem',
          }"
          :bordered="false"
          placeholder="Search for pages"
          @change="onChange"
          @press-enter="onInputBoxEnter"
          @keydown="handleInputBoxKeyDown"
        />
      </div>

      <div class="w-full h-64 -ml-1" data-testid="nc-docs-link-option-searched-pages">
        <div
          class="flex flex-col space-y-1 bg-gray-50 w-full mt-2 pt-4 px-4 rounded-lg docs-link-to-page-search-pages-list max-h-64 !py-1 shadow-sm"
        >
          <div v-if="filteredPages.length === 0" class="flex flex-row items-center justify-center text-gray-500 text-sm gap-x-2">
            <div class="flex text-lg">😣</div>
            <span class="flex">No pages found</span>
          </div>
          <div
            v-for="(page, index) of filteredPages"
            v-else
            :key="index"
            class="py-1.5 px-2 flex flex-row gap-x-3 items-center rounded-md cursor-pointer mx-0.5 page-item"
            :class="{ 'bg-gray-200 selected': selectedIndex === index }"
            role="button"
            :data-testid="`nc-docs-link-option-searched-page-${page.title}`"
            @click="() => onPageClick(page)"
            @mouseenter="($event) => onMouseOver($event, index)"
          >
            <IconifyIcon
              v-if="page.icon"
              :key="page.icon"
              :data-testid="`nc-doc-page-icon-${page.icon}`"
              class="text-lg"
              :icon="page.icon"
            ></IconifyIcon>
            <MdiFileDocumentOutline v-else />

            <div class="flex">
              {{ page.title }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </BubbleMenu>
</template>

<style lang="scss">
.docs-link-to-page-search-pages-list {
  overflow-y: overlay;
  padding: 2px;
  // scrollbar reduce width and gray color
  &::-webkit-scrollbar {
    width: 3px;
  }

  /* Track */
  &::-webkit-scrollbar-track {
    background: #f6f6f600 !important;
    margin-bottom: 0.5rem;
    margin-top: 0.5rem;
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
