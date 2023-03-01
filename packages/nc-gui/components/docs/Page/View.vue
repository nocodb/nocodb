<script lang="ts" setup>
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { Icon as IconifyIcon } from '@iconify/vue'
import { TextSelection } from 'prosemirror-state'
import tiptapExtensions from '~~/utils/tiptapExtensions'
import type { PageSidebarNode } from '~~/lib'

const { project } = useProject()

const {
  openedPage: openedPageInternal,
  updateContent,
  openedNestedPages,
  nestedUrl,
  fetchPage,
  openPage,
  openedPageId,
  isPublic,
  nestedPublicParentPage,
  isFetching,
} = useDocs()

// Page opened in the Page component, which is updated to the server debounce-ly
// Main reason is to speed up the page opening, as data from sidebar might take time
// And the page content is not available in the sidebar, so we need to parallelly fetch it
const localPage = ref<PageSidebarNode | undefined>()

const wrapperRef = ref<HTMLDivElement | undefined>()

provide(DocsLocalPageInj, localPage)

const content = computed(() => localPage.value?.content || '')

const breadCrumbs = computed(() => {
  const pagesBreadcrumbs = openedNestedPages.value
    .map((page) => ({
      title: page.title,
      href: nestedUrl(page.id!),
      icon: page.icon,
    }))
    .reverse()
  return [...pagesBreadcrumbs]
})

const editor = useEditor({
  extensions: tiptapExtensions(),
  onCreate: ({ editor }) => {
    // TODO: Hack to fix the issue where cursor is on the last node, when the page is opened
    // Thus when we click on the first node's start after mount, cursor will jump back to the last node
    // Could not figure out from where the cursor change is coming from
    // So for now, we just set the cursor to the start of the first node, after the editor is mounted
    // https://github.com/nocodb/nocohub/issues/137
    setTimeout(() => {
      const draggableBlockSize = 2
      editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, draggableBlockSize)))
    })
  },
  onUpdate: ({ editor }) => {
    if (!localPage.value) return

    localPage.value.content = editor.getHTML()
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
  editable: !isPublic.value,
})

const focusEditor = () => {
  editor?.value?.commands.focus('start')
}

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
  editor.value?.commands.setContent(content.value)
})

watchDebounced(
  () => [localPage.value?.id, localPage.value?.content],
  ([newId, newContent], [oldId, oldContent]) => {
    if (!isPublic.value && localPage.value?.id && newId === oldId && newContent !== oldContent) {
      updateContent({ pageId: localPage.value?.id, content: localPage.value!.content })
    }
  },
  {
    debounce: 300,
    maxWait: 600,
  },
)

watch(
  openedPageId,
  async () => {
    if (!openedPageId.value) return

    localPage.value = undefined

    localPage.value = (await fetchPage()) as any

    if (openedPageInternal.value?.new) localPage.value!.new = true
  },
  {
    immediate: true,
  },
)

watch(
  openedPageInternal,
  () => {
    if (!localPage.value) return

    localPage.value = {
      ...openedPageInternal.value,
      content: localPage.value.content,
      title: localPage.value.title,
    } as PageSidebarNode
  },
  {
    deep: true,
  },
)
</script>

<template>
  <a-layout-content>
    <div
      v-if="localPage && !(isPublic && isFetching.nestedPages)"
      ref="wrapperRef"
      class="nc-docs-page h-full flex flex-row relative"
    >
      <div class="flex flex-col w-full">
        <div class="flex flex-row justify-between items-center pl-6 pt-2.5">
          <div class="flex flex-row h-6">
            <template v-if="!isPublic || project.meta?.isPublic || nestedPublicParentPage?.is_nested_published">
              <div v-for="({ href, title, icon }, index) of breadCrumbs" :key="href" class="flex">
                <NuxtLink
                  class="text-sm !hover:text-black docs-breadcrumb-item !underline-transparent"
                  :to="href"
                  :class="{
                    '!text-gray-600 ': index === breadCrumbs.length - 1,
                    '!text-gray-400 ': index !== breadCrumbs.length - 1,
                  }"
                >
                  <div class="flex flex-row items-center gap-x-1.5">
                    <IconifyIcon
                      v-if="icon"
                      :key="icon"
                      :data-testid="`nc-doc-page-icon-${icon}`"
                      class="text-sm"
                      :icon="icon"
                    ></IconifyIcon>
                    <div>
                      {{ title }}
                    </div>
                  </div>
                </NuxtLink>
                <div v-if="index !== breadCrumbs.length - 1" class="flex text-gray-400 text-sm px-2">/</div>
              </div>
            </template>
          </div>
          <div v-if="!isPublic" class="flex flex-row items-center"></div>
        </div>
        <div
          class="mx-auto pr-6 pt-16 flex flex-col"
          :style="{
            width: '64rem',
            maxWidth: '45vw',
          }"
        >
          <DocsPageTitle v-if="localPage" @focus-editor="focusEditor" />

          <DocsPageSelectedBubbleMenu v-if="editor" :editor="editor" />
          <DocsPageLinkOptions v-if="editor" :editor="editor" />
          <EditorContent
            :editor="editor"
            class="px-2"
            :class="{
              '-ml-1': isPublic,
              '-ml-12.5': !isPublic,
            }"
          />
          <div
            v-if="(openedPageInternal?.children ?? []).length > 0"
            class="flex flex-col py-12 border-b-1 border-t-1 border-gray-200 mt-12 mb-4 gap-y-6"
          >
            <div
              v-for="page of openedPageInternal?.children"
              :key="page.id"
              class="flex flex-row items-center gap-x-2 cursor-pointer text-gray-600 hover:text-black"
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
      <div class="sticky top-0 pt-1.5 flex flex-col mr-3 min-w-8">
        <DocsPageOutline :wrapper-ref="wrapperRef" />
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
  .ProseMirror-focused {
    // remove all border
    outline: none;
  }

  img {
    @apply !mb-6 !mt-2;
  }
  img[isuploading='true'] {
    @apply hidden;
  }
  .image-uploading-wrapper {
    @apply mt-1.5 !w-full;
    .image-uploading {
      @apply w-full py-2 px-3 rounded-md bg-gray-50 text-gray-500;
    }
  }

  .draggable-block-wrapper.selected {
    table {
      @apply !bg-primary-selected;
      tr:first-child td {
        @apply !bg-primary-selected;
      }
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
    img {
      @apply !bg-primary-selected;
    }

    .node-view-drag-content > ul {
      @apply !bg-primary-selected;
    }
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
      outline: 3px solid #e8eafd;
      outline-offset: -2px;
      border-radius: 4px;
    }
  }

  p.is-empty::before {
    content: attr(data-placeholder);
    font-weight: 400;
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
    font-weight: 400;
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

  ul {
    // bullet color black
    list-style: disc;
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

  div.callout-wrapper {
    @apply my-2.5;
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
}
</style>
