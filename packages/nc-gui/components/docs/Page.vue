<script lang="ts" setup>
import { EditorContent, FloatingMenu, useEditor } from '@tiptap/vue-3'
import BulletList from '@tiptap/extension-bullet-list'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Underline from '@tiptap/extension-underline'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import DropCursor from '@tiptap/extension-dropcursor'
import ListItem from '@tiptap/extension-list-item'
import Bold from '@tiptap/extension-bold'
import Strike from '@tiptap/extension-strike'
import Heading from '@tiptap/extension-heading'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlock from '@tiptap/extension-code-block'
import Blockquote from '@tiptap/extension-blockquote'
import { TableCell } from './tiptap-extensions/table/TableCell'
import { TableHeader } from './tiptap-extensions/table/header'
import { TableRow } from './tiptap-extensions/table/row'
import Table from './tiptap-extensions/table'
import { History } from './tiptap-extensions/history'
import suggestion from './tiptap-extensions/commands/suggestion'
import { createImageExtension } from './tiptap-extensions/images/node'
import Commands from './tiptap-extensions/commands'
import { InfoCallout } from './tiptap-extensions/callouts/info'
import { WarningCallout } from './tiptap-extensions/callouts/warning'
import { TipCallout } from './tiptap-extensions/callouts/tip'
import { DraggableBlock } from './tiptap-extensions/draggableBlock'
import { Document } from './tiptap-extensions/document'
import type { PageSidebarNode } from '~~/composables/docs/useDocs'

const isPublic = inject(IsDocsPublicInj, ref(false))

const {
  openedPage: openedPageInternal,
  openedBook,
  updatePage,
  updateContent,
  openedNestedPagesOfBook,
  nestedUrl,
  bookUrl,
  uploadFile,
  fetchPage,
  openPage,
} = useDocs()

const isTitleInputRefLoaded = ref(false)
const isLoading = ref(false)
const titleInputRef = ref<HTMLInputElement>()
const _openedPage = ref<PageSidebarNode | undefined>()
const openedPage = computed<PageSidebarNode | undefined>({
  get: () => _openedPage.value,
  set: (value) => {
    if (!value) return

    _openedPage.value = value
  },
})

const title = computed({
  get: () => (openedPage.value!.new ? '' : openedPage.value?.title || ''),
  set: (value) => {
    openedPage.value = { ...openedPage.value!, title: value, new: false }
  },
})
const content = computed(() => openedPage.value?.content || '')

const breadCrumbs = computed(() => {
  const bookBreadcrumb = {
    title: openedBook.value!.title,
    href: bookUrl(openedBook.value!.slug!),
  }
  const pagesBreadcrumbs = openedNestedPagesOfBook.value.map((page) => ({
    title: page.title,
    href: nestedUrl(page.slug!),
  }))
  return [bookBreadcrumb, ...pagesBreadcrumbs]
})

const editor = useEditor({
  extensions: [
    Document,
    DraggableBlock,
    // StarterKit.configure({
    //   history: false,
    // }),
    Paragraph,
    Text,
    Strike,
    Heading,
    ListItem,
    Bold,
    DropCursor.configure({
      width: 2,
      class: 'notitap-dropcursor',
      color: 'skyblue',
    }),
    Commands.configure({
      suggestion,
    }),
    Placeholder.configure({
      placeholder: 'Press / to open the command menu or start writing',
    }),
    BulletList,
    TaskList.configure({
      HTMLAttributes: {
        class: 'nc-docs-task-list',
      },
    }),
    TaskItem.configure({
      nested: true,
    }),
    HorizontalRule.configure({
      HTMLAttributes: {
        class: 'nc-docs-horizontal-rule',
      },
    }),
    CodeBlock,
    createImageExtension(async (image) => {
      const { url } = await uploadFile(image)
      return url
    }),
    Underline,
    History,
    Blockquote,
    InfoCallout,
    WarningCallout,
    TipCallout,
    Table.configure({
      resizable: true,
    }),
    TableRow,
    TableHeader,
    TableCell.configure({
      HTMLAttributes: {
        class: 'nc-docs-tiptap-table-cell relative',
      },
    }),
  ],
  onUpdate: ({ editor }) => {
    if (!openedPage.value) return

    openedPage.value.content = editor.getHTML()
  },
  editorProps: {
    handleKeyDown: (view, event) => {
      if (event.altKey) {
        event.preventDefault()
        editor?.value?.commands.blur()
        return
      }
      return false
    },
  },
  editable: !isPublic.value,
})

watch(
  () => content.value,
  () => {
    if (!editor.value) return

    if (content.value !== editor.value?.getHTML()) {
      editor.value.commands.setContent(content.value)
    }
  },
)

watch(editor, () => {
  if (!editor.value) return

  editor.value.commands.setContent(content.value)
  document.tipTapEditor = editor.value
})

const onTitleKeyDown = (e: KeyboardEvent) => {
  if (e.altKey) {
    e.preventDefault()
    titleInputRef.value?.blur()
    return
  }

  if (e.key === 'Enter') {
    e.preventDefault()
    editor?.value?.commands.focus('start')
  }
}

watchDebounced(
  () => [openedPage.value?.id, openedPage.value?.title],
  async ([newId, newTitle], [oldId, oldTitle]) => {
    if (newId === oldId && newTitle && newTitle.length > 0 && newTitle !== oldTitle) {
      await updatePage({ pageId: newId!, page: { title: newTitle } as any })
    }
  },
  {
    debounce: 100,
    maxWait: 300,
  },
)

// todo: Hack to focus on title when its edited since on edit route is changed
watch(titleInputRef, (el) => {
  if (!isTitleInputRefLoaded.value && !openedPage.value?.new) {
    isTitleInputRefLoaded.value = true
    return
  }

  isTitleInputRefLoaded.value = true
  el?.focus()
})

watchDebounced(
  () => [openedPage.value?.id, openedPage.value?.content],
  ([newId], [oldId]) => {
    if (!isPublic.value && openedPage.value?.id && newId === oldId) {
      updateContent({ pageId: openedPage.value?.id, content: openedPage.value!.content })
    }
  },
  {
    debounce: 300,
    maxWait: 600,
  },
)

watch(
  () => openedPage.value?.id,
  async () => {
    isLoading.value = true
    openedPage.value = (await fetchPage({ page: openedPage.value! })) as any
    if (openedPageInternal.value?.new) openedPage.value!.new = true
    isLoading.value = false
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <a-layout-content>
    <div v-if="openedPage" class="nc-docs-page overflow-y-auto h-full">
      <div class="flex flex-row justify-between items-center ml-14 mt-8">
        <a-breadcrumb v-if="breadCrumbs.length > 1" class="!px-2">
          <a-breadcrumb-item v-for="({ href, title }, index) of breadCrumbs" :key="href">
            <NuxtLink
              class="text-sm !hover:text-black docs-breadcrumb-item !underline-transparent"
              :to="href"
              :class="{
                '!text-gray-600 ': index === breadCrumbs.length - 1,
                '!text-gray-400 ': index !== breadCrumbs.length - 1,
              }"
            >
              {{ title }}
            </NuxtLink>
          </a-breadcrumb-item>
        </a-breadcrumb>
        <div v-else class="flex"></div>
        <div v-if="!isPublic" class="flex flex-row items-center"></div>
      </div>
      <div
        class="mx-auto px-6 pt-8 flex flex-col"
        :style="{
          maxWidth: '60vw',
        }"
      >
        <a-input
          ref="titleInputRef"
          v-model:value="title"
          class="!text-5xl font-semibold !px-1.5 !mb-6"
          :bordered="false"
          :readonly="isPublic"
          :placeholder="openedPage.title"
          auto-size
          @keydown="onTitleKeyDown"
        />

        <DocsTiptapExtensionsSelectedBubbleMenu v-if="editor" :editor="editor" />
        <FloatingMenu v-if="editor" :editor="editor" :tippy-options="{ duration: 100, placement: 'left' }">
          <MdiPlus
            class="hover:cursor-pointer hover:bg-gray-50 rounded-md"
            :class="{
              'mr-8': editor?.isActive('infoCallout') || editor?.isActive('tipCallout') || editor?.isActive('warningCallout'),
            }"
            @click="editor!.chain().focus().insertContent('/').run()"
          />
        </FloatingMenu>
        <EditorContent v-if="!isLoading" :editor="editor" class="px-2 -ml-12.5" />
        <div
          v-if="!isLoading && openedPageInternal?.children?.length !== 0"
          class="flex flex-col py-12 border-b-1 border-t-1 border-gray-200 mt-12 mb-4 gap-y-6"
        >
          <div
            v-for="page of openedPageInternal?.children"
            :key="page.id"
            class="flex flex-row items-center gap-x-2 cursor-pointer"
            @click="openPage(page)"
          >
            <MdiFileDocumentOutline class="flex" />
            <div class="font-semibold text-base">
              {{ page.title }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </a-layout-content>
</template>

<style lang="scss">
::-moz-selection {
  /* Code for Firefox */
  color: black;
  background-color: #1c26b820;
}

::selection {
  color: black;
  background-color: #1c26b820;
}

.nc-docs-page {
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
.nc-docs-page:hover {
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
  > * + * {
    margin-top: 0.75em;
  }

  .ProseMirror-focused {
    // remove all border
    outline: none;
  }

  div[contenteditable='false'].ProseMirror {
    user-select: text !important;
  }

  img {
    max-width: 100%;
    max-height: 30rem;
    height: auto;
    // align center
    display: block;
    margin-left: auto;
    margin-right: auto;

    &.ProseMirror-selectednode {
      // outline with rounded corners
      outline: 3px solid #4351e8;
      outline-offset: -2px;
      border-radius: 4px;
    }
  }

  p.is-empty::before {
    content: attr(data-placeholder);
    float: left;
    color: #bcc2c8;
    pointer-events: none;
    height: 0;
  }

  .nc-docs-list-item > p {
    margin-top: 0.25rem !important;
    margin-bottom: 0.25rem !important;
  }

  p {
    margin-top: 1em;
    margin-bottom: 1em;
  }

  h1 {
    font-size: 1.75rem;
  }

  h2 {
    font-size: 1.5rem;
  }

  h3 {
    font-size: 1.35rem;
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
    @apply overflow-auto;
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

  ul {
    padding-left: 1rem;
    // bullet color black
    color: #000;
    list-style: disc;
    li > p {
      margin-top: 0.25rem !important;
      margin-bottom: 0.25rem !important;
    }
  }

  hr.nc-docs-horizontal-rule {
    border: 0;
    border-top: 1px solid #ccc;
    margin: 1.5em 0;
  }

  blockquote {
    border-left: 3px solid #d0d5dd;
    padding: 0 1em;
    color: #666;
    margin: 1em 0;
    font-style: italic;
  }

  div.info-callout {
    @apply px-2 py-2 rounded-md border-1;
    border-color: rgb(166, 222, 254);
    background-color: rgb(230, 246, 255);
    color: #666;
    margin: 1em 0;
  }

  div.tip-callout {
    @apply px-2 py-2 rounded-md border-1;
    border-color: #fee088;
    background-color: #fef7d7;
    color: #666;
    margin: 1em 0;
  }

  div.warning-callout {
    @apply px-2 py-2 rounded-md border-1;
    border-color: #ffa58b;
    background-color: #ffe7d8;
    color: #666;
    margin: 1em 0;
  }

  .column-resize-handle {
    background-color: #e3e5ff !important;
    width: 6px;
    cursor: col-resize;
    z-index: 1;
  }

  table {
    border-collapse: collapse;
    table-layout: fixed;
    width: 100%;
    margin: 0;
    overflow: visible;
    tbody {
      overflow: visible;
    }
    td,
    th {
      position: relative;
      min-width: 1em;
      border: 1px solid #e5e5e5;
      vertical-align: top;
      box-sizing: border-box;
      overflow: visible !important;
      height: 20px;
      > * {
        margin-bottom: 0;
      }
    }

    td {
      overflow: visible !important;
      border-top: 0;
    }

    th {
      @apply font-semibold;
      text-align: left;
      background-color: #fafbfb;
    }

    .column-resize-handle {
      position: absolute;
      right: 0px;
      top: 0;
      bottom: -2px;
      width: 0px;
      outline: 2px solid #e3e5ff;
      background-color: #adf;
      pointer-events: none;
    }

    p {
      margin: 0;
    }

    tr.ProseMirror-selectednode {
      @apply bg-primary-selected;
    }
  }

  .resize-cursor {
    cursor: ew-resize;
    cursor: col-resize;
  }
}
</style>
