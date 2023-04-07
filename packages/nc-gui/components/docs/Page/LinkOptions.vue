<script lang="ts" setup>
import { defineProps } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3'
import { getMarkRange } from '@tiptap/core'
import type { Mark } from 'prosemirror-model'

const { editor } = defineProps<Props>()

const { project } = storeToRefs(useProject())

const { flattenedNestedPages, openedPage } = storeToRefs(useDocStore())
const { nestedSlugsFromPageId, nestedUrl } = useDocStore()
interface Props {
  editor: Editor
}

const inputRef = ref<HTMLInputElement>()
const selectedIndex = ref(0)
const linkNodeMark = ref<Mark | undefined>()
const href = ref('')
const isLinkOptionsVisible = ref(false)

// Used in Page list keyboard navigation as when we scroll with and up and dow arrow
// List moves relative to the cursor position, so we need to store the cursor position
// So we can ignore the cursor position when we scroll with the arrow keys
const cursorPos = ref({ x: 0, y: 0 })

const filteredPages = computed(() => {
  if (!href.value || href.value === '') return []

  const hrefText = href.value.toLowerCase()

  return flattenedNestedPages.value.filter((page) => {
    return page.title.toLowerCase().includes(hrefText) && page.id !== openedPage.value?.id
  })
})

// Is set when a page is selected from the search list and removed when the link is create
const isInternalLink = ref(false)

// This is used to prevent the menu from showing up after a link is deleted, an edge case when the link with empty placeholder text is deleted.
// This is because checkLinkMark is not called in that case
const justDeleted = ref(false)

// This function is called by BubbleMenu on selection change
// It is used to check if the link mark is active and only show the menu if it is
const checkLinkMark = (editor: Editor) => {
  if (!editor.view.editable) return false

  if (justDeleted.value) {
    setTimeout(() => {
      justDeleted.value = false
    }, 100)
    return false
  }

  const activeNode = editor?.state?.selection?.$from?.nodeBefore || editor?.state?.selection?.$from?.nodeAfter

  const isLinkMarkedStoredInEditor = editor?.state?.storedMarks?.some((mark: Mark) => mark.type.name === 'link')

  const isActiveNodeMarkActive = activeNode?.marks?.some((mark: Mark) => mark.type.name === 'link') || isLinkMarkedStoredInEditor

  if (isActiveNodeMarkActive) {
    linkNodeMark.value = activeNode?.marks.find((mark: Mark) => mark.type.name === 'link')
    href.value = linkNodeMark.value?.attrs?.href
  }

  if (isLinkMarkedStoredInEditor) {
    linkNodeMark.value = editor?.state?.storedMarks?.find((mark: Mark) => mark.type.name === 'link')
    href.value = linkNodeMark.value?.attrs?.href
  }

  const isTextSelected = editor?.state?.selection?.from !== editor?.state?.selection?.to

  // check if active node is a text node
  const showLinkOptions = isActiveNodeMarkActive && !isTextSelected
  isLinkOptionsVisible.value = !!showLinkOptions

  return showLinkOptions
}

const onChange = (internalPageLink?: string) => {
  const isLinkMarkedStoredInEditor = editor?.state?.storedMarks?.some((mark: Mark) => mark.type.name === 'link')
  let formatedHref = href.value
  if (isValidURL(href.value) && href.value.length > 0 && !href.value.startsWith('/') && !href.value.startsWith('http')) {
    formatedHref = `https://${href.value}`
  }

  if (isLinkMarkedStoredInEditor) {
    editor.view.dispatch(
      editor.view.state.tr
        .removeStoredMark(editor?.schema.marks.link)
        .addStoredMark(
          editor?.schema.marks.link.create({ href: formatedHref, internal: isInternalLink.value, internalUrl: internalPageLink }),
        ),
    )
  } else if (linkNodeMark.value) {
    const selection = editor?.state?.selection
    const markSelection = getMarkRange(selection.$anchor, editor?.schema.marks.link) as any

    editor.view.dispatch(
      editor.view.state.tr
        .removeMark(markSelection.from, markSelection.to, editor?.schema.marks.link)
        .addMark(
          markSelection.from,
          markSelection.to,
          editor?.schema.marks.link.create({ href: formatedHref, internal: isInternalLink.value, internalUrl: internalPageLink }),
        ),
    )
  }
}

const onDelete = () => {
  const isLinkMarkedStoredInEditor = editor?.state?.storedMarks?.some((mark: Mark) => mark.type.name === 'link')

  if (isLinkMarkedStoredInEditor) {
    editor.view.dispatch(editor.view.state.tr.removeStoredMark(editor?.schema.marks.link))
  } else if (linkNodeMark.value) {
    const selection = editor?.state?.selection
    const markSelection = getMarkRange(selection.$anchor, editor?.schema.marks.link) as any

    editor.view.dispatch(editor.view.state.tr.removeMark(markSelection.from, markSelection.to, editor?.schema.marks.link))
  }

  justDeleted.value = true
}

const onPageClick = (page: any) => {
  const url = nestedUrl({ id: page.id, projectId: project.value.id! })
  href.value = `/#${url}`

  try {
    isInternalLink.value = true
    onChange(`/#${nestedUrl({ id: page.id, projectId: project.value.id!, publicUrl: true })}`)
  } finally {
    isLinkOptionsVisible.value = false
  }

  const selectedNode = editor?.state?.selection?.$from?.nodeBefore || editor?.state?.selection?.$from?.nodeAfter

  if (selectedNode?.text && selectedNode.text.length > 0) {
    return
  }

  editor.chain().focus().insertContent(page.title).run()
}

const scrollToViewPageList = () => {
  const selectedItem = document.querySelector('.bubble-menu .page-item.selected')
  if (selectedItem) {
    selectedItem.scrollIntoView({ block: 'center' })
  }
}

const handleKeyDown = (e: any) => {
  if (e.key === 'Enter') {
    e.preventDefault()
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
}

const onInputBoxEnter = () => {
  inputRef.value?.blur()
  editor.chain().focus().run()
}

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

const openLink = () => {
  if (href.value) {
    window.open(href.value, '_blank')
  }
}
</script>

<template>
  <BubbleMenu :editor="editor" :tippy-options="{ duration: 100, maxWidth: 600 }" :should-show="(checkLinkMark as any)">
    <div
      v-if="!justDeleted"
      ref="wrapperRef"
      class="relative bubble-menu docs-link-options flex flex-col bg-gray-50 py-1 px-1"
      :class="{
        'rounded-lg': filteredPages.length === 0,
        'rounded-t-lg': filteredPages.length > 0,
      }"
      data-testid="nc-docs-link-options"
      @keydown="handleKeyDown"
    >
      <div class="flex items-center gap-x-1">
        <div class="!border-1 !border-gray-200 !py-0.5 bg-gray-100 rounded-md !z-10">
          <a-input
            ref="inputRef"
            v-model:value="href"
            class="docs-link-option-input flex-1 !w-96 !mx-0.5 !py-0.5 !rounded-md z-10"
            :bordered="false"
            placeholder="Search for pages or enter a link"
            @change="onChange"
            @press-enter="onInputBoxEnter"
            @keydown="handleInputBoxKeyDown"
          />
        </div>
        <a-popover overlay-class-name="docs-link-options">
          <template #content> Open link </template>
          <div
            class="flex ml-0.5 p-0.5 my-0.5 rounded-md cursor-pointer text-gray-600 hover:text-black"
            :class="{
              '!text-gray-300 cursor-not-allowed': href.length === 0,
            }"
            data-testid="nc-docs-link-options-open-link"
            @click="openLink"
          >
            <IcBaselineArrowOutward />
          </div>
        </a-popover>
        <a-popover overlay-class-name="docs-link-options">
          <template #content> Delete link </template>
          <div
            class="flex mr-1 p-0.5 my-0.5 rounded-md cursor-pointer hover:text-red-400"
            data-testid="nc-docs-link-options-open-delete"
            @click="onDelete"
          >
            <MdiDeleteOutline />
          </div>
        </a-popover>
        <div class="absolute -bottom-1.5 left-0 right-0 w-full flex flex-row justify-center">
          <div
            class="flex h-2.5 w-2.5 bg-gray-50 border-gray-100 border-r-1 border-b-1"
            :style="{ transform: 'rotate(45deg)' }"
          ></div>
        </div>
      </div>
      <div
        v-if="filteredPages.length > 0"
        class="absolute w-full -bottom-62 left-0 h-64"
        data-testid="nc-docs-link-option-searched-pages"
      >
        <div
          class="bubble-menu flex flex-col -bottom-22 space-y-1 bg-gray-50 w-full mt-2 pt-4 px-4 rounded-b-lg docs-links-search-pages-list max-h-64 !pb-1"
        >
          <div
            v-for="(page, index) of filteredPages"
            :key="index"
            class="py-2 px-3.5 flex flex-row gap-x-3 items-center rounded-md cursor-pointer mx-0.5 page-item"
            :class="{ 'bg-gray-200 selected': selectedIndex === index }"
            role="button"
            :data-testid="`nc-docs-link-option-searched-page-${page.title}`"
            @click="() => onPageClick(page)"
            @mouseenter="($event) => onMouseOver($event, index)"
          >
            <MdiFileDocumentOutline />
            <div class="flex flex-col">
              <div class="flex">
                {{ page.title }}
              </div>
              <div class="flex text-xs text-gray-400">
                {{ nestedSlugsFromPageId({ id: page.id!, projectId: project.id! }).join('/') }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BubbleMenu>
</template>

<style lang="scss">
.bubble-menu {
  // shadow
  @apply shadow-gray-200 shadow-sm;
}

.docs-link-options {
  .ant-popover-inner-content {
    @apply !shadow-none !p-0;
  }
  .ant-popover-arrow {
    @apply !shadow-none;
    .ant-popover-arrow-content {
      @apply !shadow-none !bg-gray-100;
    }
  }
  .ant-popover-inner {
    @apply !shadow-none !bg-gray-100 py-1.5 px-2.5 text-xs !rounded-sm;
  }
}

.docs-links-search-pages-list {
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
