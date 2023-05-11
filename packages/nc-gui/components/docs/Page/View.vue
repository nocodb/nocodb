<script lang="ts" setup>
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { Icon as IconifyIcon } from '@iconify/vue'
import { TiptapNodesTypes } from 'nocodb-sdk'
import { generateJSON } from '@tiptap/html'
import { useShortcuts } from '../utils'
import tiptapExtensions from '~~/utils/tiptapExtensions'
import AlignRightIcon from '~icons/tabler/align-right'
import { removeUploadingPlaceHolderAndEmptyLinkNode } from '~~/utils/tiptapExtensions/helper'

const { project } = useProject()
useShortcuts()

const {
  openedPageId,
  openedPage,
  openedPageInSidebar,
  openedPageWithParents,
  isPublic,
  isEditAllowed: _isEditAllowed,
  isPageFetching,
  flattenedNestedPages,
} = storeToRefs(useDocStore())

const { currentHistory } = storeToRefs(useDocHistoryStore())
const { updatePage, nestedUrl, openPage } = useDocStore()

const isEditAllowed = computed(() => _isEditAllowed.value && !currentHistory.value)

const showHistoryPanel = ref(false)
const showOutline = ref(isPublic.value)
const pageWrapperDomRef = ref<HTMLDivElement | undefined>()
const pageContentDomRef = ref<HTMLDivElement | undefined>()

const selectionBox = ref<
  { left: number; right: number; top: number; bottom: number; anchorLeft: number; anchorTop: number } | undefined
>()

const content = computed(() => {
  const emptyContent = {
    type: TiptapNodesTypes.doc,
    content: [
      {
        type: TiptapNodesTypes.sec,
        content: [
          {
            type: TiptapNodesTypes.paragraph,
          },
        ],
      },
    ],
  }

  if (openedPage.value?.content?.length) {
    try {
      return JSON.parse(openedPage.value.content)
    } catch (e) {
      console.error(e)
    }
  }

  return emptyContent
})

const breadCrumbs = computed(() => {
  const pagesBreadcrumbs = openedPageWithParents.value
    .map((page) => ({
      title: page.title,
      href: nestedUrl({ id: page.id!, projectId: project.id! }),
      icon: page.icon,
      id: page.id,
    }))
    .reverse()
  return [...pagesBreadcrumbs]
})

const editor = useEditor({
  extensions: tiptapExtensions(isPublic.value),
  onUpdate: ({ editor }) => {
    if (!openedPage.value) return
    if (currentHistory.value) return

    openedPage.value.content = JSON.stringify(removeUploadingPlaceHolderAndEmptyLinkNode(editor.getJSON()))
    openedPage.value.content_html = editor.getHTML()
  },
  editorProps: {
    handleKeyDown: (view, event) => {
      if (event.altKey && ['KeyM', 'KeyN', 'KeyB'].includes(event.code)) {
        event.preventDefault()

        const { from, to } = view.state.selection

        editor.value?.commands.blur()

        setTimeout(() => {
          view.dispatch(view.state.tr.deleteRange(from, to + 1))
        }, 0)
        return true
      }
      return false
    },
  },
  editable: isEditAllowed.value,
})

const focusEditor = () => {
  editor?.value?.commands.focus('start')
}

watch(
  isEditAllowed,
  () => {
    editor.value?.setOptions({
      editable: isEditAllowed.value,
    })
  },
  {
    immediate: true,
  },
)

const setEditorContent = (_content: any, _isEditAllowed?: boolean, isHtml?: boolean) => {
  if (!editor.value) return
  ;(editor.value.state as any).history$.prevRanges = null
  ;(editor.value.state as any).history$.done.eventCount = 0

  _isEditAllowed = _isEditAllowed ?? isEditAllowed.value

  editor.value?.setOptions({
    editable: _isEditAllowed,
  })

  const selection = editor.value.view.state.selection
  if (isHtml) {
    _content = generateJSON(_content, tiptapExtensions(_isEditAllowed))
  }
  editor.value.chain().setContent(_content).setTextSelection(selection.to).run()
}

watch(
  () => [openedPage.value?.id, editor.value],
  ([newId], oldVal) => {
    if (oldVal === undefined) return
    if (currentHistory.value) return

    const [oldId, oldEditor] = oldVal

    if (!editor.value) return
    if (!openedPage.value?.id) return

    if (newId === oldId && oldEditor) return
    setEditorContent(content.value)
  },
  {
    immediate: true,
    deep: true,
  },
)

watchDebounced(
  () => [openedPage.value?.id, openedPage.value?.content],
  ([newId, newContent], [oldId, oldContent]) => {
    if (isEditAllowed && openedPage.value?.id && newId === oldId && newContent !== oldContent) {
      updatePage({
        pageId: openedPage.value?.id,
        page: { content: openedPage.value!.content, content_html: openedPage.value!.content_html },
        disableLocalSync: true,
        projectId: project.id!,
      })
    }
  },
  {
    debounce: 300,
    maxWait: 600,
  },
)

// This is a workaround to make drag and drop work outside of the editor

const handleOutsideTiptapDrag = (e: DragEvent, type: 'drop' | 'dragover' | 'dragend') => {
  e.preventDefault()

  // Maintain x and y position of the cursor in the editor
  const { x, y } = e
  const rect = editor.value?.view.dom.getBoundingClientRect()
  if (!rect) return

  const { left, top, right, bottom } = rect

  let newX = x < left ? left : x
  newX = newX > right ? right : newX
  let newY = y < top ? top : y
  newY = newY > bottom ? bottom : newY

  if (newX === x && newY === y) return

  const newEvent = new DragEvent(type, { ...e, clientX: newX, clientY: newY, dataTransfer: e.dataTransfer })
  const editorDom = document.querySelector('.ProseMirror') as HTMLElement

  editorDom.dispatchEvent(newEvent)
}

watch(pageWrapperDomRef, () => {
  if (!pageWrapperDomRef.value) return
  const wrapper = pageWrapperDomRef.value

  // Move all drag events to tiptap
  wrapper.addEventListener('dragend', (e) => handleOutsideTiptapDrag(e, 'dragend'))

  wrapper.addEventListener('dragover', (e) => {
    const viewportHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)
    const y = e.clientY

    if (y > viewportHeight - viewportHeight * 0.3) {
      const el = document.querySelector('.nc-docs-page-content')
      el?.scrollBy(0, 10)
    }

    // If add the top of viewport, scroll up
    if (y < viewportHeight * 0.3) {
      const el = document.querySelector('.nc-docs-page-content')
      el?.scrollBy(0, -10)
    }

    handleOutsideTiptapDrag(e, 'dragover')
  })

  wrapper.addEventListener('drop', (e) => handleOutsideTiptapDrag(e, 'drop'))
})

watch(
  currentHistory,
  () => {
    if (!currentHistory.value) {
      setEditorContent(content.value)
      return
    }

    setEditorContent(currentHistory.value.diff, false, true)
  },
  {
    deep: true,
  },
)
</script>

<template>
  <a-layout-content>
    <div ref="pageWrapperDomRef" data-testid="docs-opened-page" class="nc-docs-page h-full flex flex-row relative">
      <div
        class="flex flex-col w-full"
        :class="{
          readonly: !isEditAllowed,
          editable: isEditAllowed,
        }"
      >
        <div class="flex flex-row justify-between items-center pl-6 my-2 h-8">
          <div class="flex flex-row">
            <template v-if="flattenedNestedPages.length !== 0">
              <div v-for="({ href, title, icon, id }, index) of breadCrumbs" :key="id" class="flex">
                <NuxtLink
                  class="text-sm !hover:text-black docs-breadcrumb-item !underline-transparent"
                  :to="href"
                  :class="{
                    '!text-gray-600 ': index === breadCrumbs.length - 1,
                    '!text-gray-400 ': index !== breadCrumbs.length - 1,
                  }"
                  :data-testid="`nc-doc-page-breadcrumb-${index}`"
                >
                  <div class="flex flex-row items-center gap-x-1.5">
                    <IconifyIcon
                      v-if="icon"
                      :key="icon"
                      :data-testid="`nc-doc-page-icon-${icon}`"
                      class="text-sm pop-in-animation"
                      :icon="icon"
                    ></IconifyIcon>
                    <div class="pop-in-animation">
                      {{ title }}
                    </div>
                  </div>
                </NuxtLink>
                <div v-if="index !== breadCrumbs.length - 1" class="flex text-gray-400 text-sm px-2">/</div>
              </div>
            </template>
          </div>
          <div v-if="!isPublic" class="flex flex-row items-center"></div>
          <div class="flex flex-row items-center gap-x-1 mr-2 mt-0.25">
            <div
              class="p-1 flex items-center hover:bg-gray-100 cursor-pointer rounded-md mr-2"
              @click="showHistoryPanel = !showHistoryPanel"
            >
              <MaterialSymbolsHistoryRounded />
            </div>
            <div class="">
              <LazyGeneralShareProject />
            </div>
            <div class="flex flex-row">
              <div class="flex flex-row justify-end cursor-pointer rounded-md">
                <div
                  data-testid="docs-page-outline-toggle"
                  class="flex p-1 cursor-pointer rounded-md pop-in-animation-med-delay"
                  :class="{
                    'bg-gray-100 hover:bg-gray-200': showOutline,
                    'bg-white hover:bg-gray-100': !showOutline,
                  }"
                  :aria-expanded="showOutline"
                  @click="showOutline = !showOutline"
                >
                  <AlignRightIcon />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div ref="pageContentDomRef" class="nc-docs-page-content relative pb-20">
          <DocsPageMutliSectionSelector
            v-if="isEditAllowed && editor && pageContentDomRef"
            :editor="editor"
            :selection-box="selectionBox"
            :page-content-dom-ref="pageContentDomRef"
            @update:selection-box="selectionBox = $event"
          />
          <div
            :key="openedPageId ?? currentHistory?.content ?? ''"
            class="mx-auto pr-6 pt-16 flex flex-col"
            :style="{
              width: '64rem',
              maxWidth: '45vw',
            }"
          >
            <a-skeleton-input
              v-if="isPageFetching && !isPublic"
              :active="true"
              size="large"
              class="docs-page-title-skelton !mt-3 !max-w-156 mb-3 ml-8 docs-page-skeleton-loading"
            />
            <DocsPageTitle v-else-if="openedPage && currentHistory?.type !== 'title_update'" :key="openedPage.id" class="docs-page-title" @focus-editor="focusEditor" />
            <div v-else class="flex flex-col">
              <div class="py-2 mb-1 bg-red-200 rounded-sm">
                <DocsPageTitle class="docs-page-title" @focus-editor="focusEditor" :title="currentHistory.before_page.title" :key="currentHistory.before_page.title"/>
              </div>
              <div class="py-2 bg-green-200 rounded-sm">
                <DocsPageTitle class="docs-page-title" @focus-editor="focusEditor" :title="currentHistory.after_page.title" :key="currentHistory.before_page.title"/>
              </div>
            </div>
            <div class="flex !mb-4.5"></div>

            <DocsPageLinkToPageSearch v-if="editor" :editor="editor" />
            <DocsPageSelectedBubbleMenu
              v-if="editor"
              :editor="editor"
              :class="{
                hidden: selectionBox,
              }"
            />
            <DocsPageLinkOptions v-if="editor" :editor="editor" />
            <a-skeleton-input
              v-if="isPageFetching && !isPublic"
              :active="true"
              size="small"
              class="docs-page-title-skelton !max-w-102 mb-3 mt-1 ml-8 docs-page-skeleton-loading"
            />
            <EditorContent v-else :key="isEditAllowed ? 'edit' : 'view'" data-testid="docs-page-content" :editor="editor" />
            <div
              v-if="(openedPageInSidebar?.children ?? []).length > 0 && !isPageFetching"
              class="docs-page-child-pages flex flex-col py-12 border-b-1 border-t-1 border-gray-200 mt-12 mb-4 gap-y-6 pop-in-animation"
              :class="{
                'ml-6': !isPublic,
              }"
            >
              <div
                v-for="page of openedPageInSidebar?.children"
                :key="page.id"
                class="docs-page-child-page px-6 flex flex-row items-center gap-x-2 cursor-pointer text-gray-600 hover:text-black"
                @click="openPage({ page, projectId: project.id! })"
              >
                <div v-if="page.icon" class="flex">
                  <IconifyIcon
                    :key="page.icon"
                    :data-testid="`nc-doc-page-icon-${page.icon}`"
                    class="flex text-lg pop-in-animation"
                    :icon="page.icon"
                  ></IconifyIcon>
                </div>
                <MdiFileDocumentOutline v-else class="flex pop-in-animation ml-0.25" />
                <div class="font-semibold text-base pop-in-animation">
                  {{ page.title }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <DocsPageHistory v-if="showHistoryPanel" @close="showHistoryPanel = false" />
    </div>
    <DocsPageOutline
      v-if="showOutline && openedPage && pageWrapperDomRef"
      :key="openedPage.id"
      :wrapper-ref="pageWrapperDomRef"
    />
  </a-layout-content>
</template>

<style lang="scss">
::-moz-selection {
  /* Code for Firefox */
  color: inherit;
  background-color: #1c26b820;
}

::selection {
  color: inherit;
  background-color: #1c26b820;
}

.docs-page-title-skelton {
  .ant-skeleton-input {
    @apply !rounded-md;
  }
}

.nc-docs-page-content {
  overflow-y: overlay;
  // scrollbar reduce width and gray color
  &::-webkit-scrollbar {
    width: 6px;
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
.nc-docs-page-content:hover {
  // scrollbar reduce width and gray color
  &::-webkit-scrollbar {
    width: 6px;
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

.nc-docs-page {
  .ProseMirror-focused {
    // remove all border
    outline: none;
  }

  [data-diff-node='ins'] {
    @apply !bg-green-100 rounded-sm p-0.5 m-0.5;
  }

  [data-diff-node='del'] {
    @apply !bg-red-100 rounded-sm p-0.5 m-0.5;
  }

  del {
    @apply !bg-red-100 rounded-sm my-0.5;
    text-decoration: none;
  }
  ins {
    @apply !bg-green-100 rounded-sm my-0.5 mx-0.5;
    text-decoration: none;
  }

  ins[isempty='true'] {
    display: block;
    color: transparent;
    user-select: none;
    @apply !w-full;
  }
  del[isempty='true'] {
    display: block;
    color: transparent;
    user-select: none;
    @apply !w-full;
  }

  td {
    ins {
      @apply !p-0 !m-0;
    }
  }

  .draggable-block-wrapper.focused {
    .attachment-wrapper .attachment {
      @apply !bg-primary-selected;
    }
  }

  .draggable-block-wrapper.selected {
    table {
      @apply !bg-primary-selected;
      tr:first-child td {
        @apply !bg-primary-selected;
      }
    }
    .attachment-wrapper .attachment {
      @apply !bg-primary-selected;
    }
    p,
    h1,
    h2,
    h3,
    h4,
    h5,
    h6,
    li,
    blockquote,
    pre,
    code,
    img,
    .link-to-page-wrapper {
      @apply !bg-primary-selected;
    }

    .node-view-drag-content > ul {
      @apply !bg-primary-selected;
    }
  }

  div[contenteditable='false'].ProseMirror {
    user-select: text !important;
  }

  p.is-empty::after,
  h1.is-empty::after,
  h2.is-empty::after,
  h3.is-empty::after {
    content: attr(data-placeholder);
    float: left;
    color: #afafaf;
    pointer-events: none;
    margin-top: -1.55rem;
    margin-left: 0.01rem;
  }

  [data-one-content='true'] [data-type='collapsable_content'] {
    p.is-empty::after {
      content: 'Empty collapsable. Press / to open the command menu or start writing';
    }
  }

  p.is-empty::after {
    margin-top: -1.55rem;
  }
  h1.is-empty::after {
    margin-top: -2.85rem;
  }
  h2.is-empty::after {
    margin-top: -2.25rem;
  }
  h3.is-empty::after {
    margin-top: -1.8rem;
  }
  .collapsable-wrapper {
    h1,
    h2,
    h3 {
      margin-top: 0;
      margin-bottom: 0;
    }
  }

  .editable {
    .focused {
      div[data-is-empty='true'] {
        p::after {
          content: 'Press / to open the command menu or start writing' !important;
          float: left;
          color: #afafaf;
          pointer-events: none;
          margin-top: -1.55rem;
          margin-left: 0.01rem;
        }
      }
    }
    div.is-empty.focused {
      p::after {
        content: 'Press / to open the command menu or start writing' !important;
        float: left;
        color: #afafaf;
        pointer-events: none;
        margin-top: -1.55rem;
        margin-left: 0.01rem;
      }
    }
  }

  h1.is-empty::before,
  h2.is-empty::before,
  h3.is-empty::before {
    color: #d6d6d6;
  }

  .nc-docs-list-item > p {
    margin-top: 0.25rem !important;
    margin-bottom: 0.25rem !important;
  }

  p {
    font-weight: 400;
    color: #000000;
    font-size: 1rem;
    margin-top: 0.25rem;
    margin-bottom: 0.25rem;
  }

  h1 {
    font-weight: 600;
    font-size: 1.85rem;
    margin-bottom: 0.6em;
  }

  h2 {
    font-weight: 600;
    font-size: 1.45rem;
    margin-bottom: 0.5em;
  }

  h3 {
    font-weight: 600;
    font-size: 1.15rem;
    margin-bottom: 0.3em;
  }

  h4 {
    font-size: 1.2rem;
  }

  h5 {
    font-size: 1rem;
  }

  h6 {
    font-size: 1rem;
  }

  // Pre tag is the parent wrapper for Code block
  pre {
    background: #f2f4f7;
    border-color: #d0d5dd;
    border: 1px;
    color: black;
    font-family: 'JetBrainsMono', monospace;
    padding: 1rem;
    border-radius: 0.5rem;
    @apply overflow-auto mt-3;

    code {
      @apply !px-0;
    }
  }

  code {
    background: #f2f4f7;
    @apply rounded-md px-2 py-1;
    color: inherit;
    font-size: 0.8rem;
  }

  ul[data-type='taskList'] {
    list-style: none;
    padding: 0;

    p {
      margin: 0;
    }

    li {
      display: flex;
      padding-top: 0.25rem;
      padding-bottom: 0.25rem;

      > label {
        margin-right: 0.5rem;
        user-select: none;
      }

      > label > input {
        // margin-top: 0.1rem !important;
        margin-bottom: 0.2rem !important;
        // height: max-content;
      }

      > div {
        flex: 1 1 auto;
      }
    }
  }

  ul,
  ol {
    padding-left: 1rem;

    li > p {
      margin-top: 0.25rem !important;
      margin-bottom: 0.25rem !important;
    }
  }

  [data-type='bullet'] {
    .tiptap-list-item-content {
      display: list-item;
      list-style: disc;
      padding-left: '1rem' !important;

      p {
        margin-top: '0.01rem';
        margin-bottom: '0.01rem';
      }
    }
  }

  .readonly {
    [data-type='bullet'] {
      @apply !ml-3.5;
    }
  }

  [data-disc-style='disc'] {
    .tiptap-list-item-content {
      list-style: disc;
    }
  }
  [data-disc-style='circle'] {
    .tiptap-list-item-content {
      list-style: none;
      &::before {
        font-size: 1.2em;
        margin-right: 4px;
        margin-left: -1rem;
        line-height: 1.3;
        content: '◦';
        float: left;
      }
      // Thicker circle
    }
    .tiptap-list-item-content::marker {
      border: 4px solid black;
      border-radius: 90%;
    }
  }
  [data-disc-style='square'] {
    .tiptap-list-item-content {
      list-style: square;
    }
  }

  .collapsable-header-wrapper {
    [data-type='bullet'] {
      margin-left: 1rem;
    }
  }
  .tiptap-table-cell {
    [data-type='bullet'] {
      margin-left: 0.7rem;
    }
  }

  [data-type='ordered'] {
    @apply flex flex-row items-start gap-x-1;
    .tiptap-list-item-start > span::before {
      margin-top: 6px;
      content: attr(data-number) '. ';
      display: inline-block;
      white-space: nowrap;
    }
    .tiptap-list-item-content {
      @apply flex flex-grow;
      line-break: anywhere;
    }
  }

  [data-type='task'] {
    @apply flex flex-row items-start gap-x-2;
    label {
      @apply flex mt-2;
    }
    input {
      @apply rounded-sm;
    }
    // Unchecked
    input:not(:checked) {
      // Add border to checkbox
      border-width: 1.5px;
      @apply border-gray-700;
    }
  }

  ul {
    // bullet color black
    list-style: disc;
  }

  hr {
    border: 0;
    border-top: 1px solid #ccc;
    margin: 1.5em 0;
  }

  hr.ProseMirror-selectednode {
    // outline with rounded corners
    outline: 4px solid #e8eafd;
    border-radius: 4px;
  }
  .focused {
    hr {
      // outline with rounded corners
      outline: 4px solid #e8eafd;
      border-radius: 4px;
    }
  }
  .selected {
    hr {
      // outline with rounded corners
      outline: 4px solid #e8eafd;
      border-radius: 4px;
    }
  }

  .selected {
    .external-content-wrapper {
      // outline with rounded corners
      outline: 2px solid #e8eafd;
      border-radius: 1px;
    }
  }

  .external-content-wrapper.ProseMirror-selectednode {
    // outline with rounded corners
    outline: 2px solid #e8eafd;
    border-radius: 1px;
  }

  blockquote {
    border-left: 3px solid #d0d5dd;
    padding: 0 1em;
    color: #666;
    margin: 1em 0;
    font-style: italic;
  }

  div.callout-wrapper {
    @apply my-2.5;
  }

  div.callout {
    [data-type='bullet'] {
      margin-left: 0.7rem;
    }
  }

  div.info-callout {
    @apply px-2 py-2 rounded-md border-1;
    border-color: rgb(166, 222, 254);
    background-color: rgb(230, 246, 255);
    color: #666;
  }

  div.tip-callout {
    @apply px-2 py-2 rounded-md border-1;
    border-color: #fee088;
    background-color: #fef7d7;
    color: #666;
  }

  div.warning-callout {
    @apply px-2 py-2 rounded-md border-1;
    border-color: #ffa58b;
    background-color: #ffe7d8;
    color: #666;
  }

  .column-resize-handle {
    background-color: #e3e5ff !important;
    width: 6px;
    cursor: col-resize;
    z-index: 1;
  }

  .resize-cursor {
    cursor: ew-resize;
    cursor: col-resize;
  }

  .external-content-wrapper {
    @apply bg-gray-100 my-2;
  }

  div[data-type='column'] {
    @apply flex flex-row gap-x-12 justify-between;
  }
}
</style>
