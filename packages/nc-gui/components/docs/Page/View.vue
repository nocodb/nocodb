<script lang="ts" setup>
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { Icon as IconifyIcon } from '@iconify/vue'
import { useShortcuts } from '../utils'
import tiptapExtensions from '~~/utils/tiptapExtensions'

const { project } = useProject()
useShortcuts()

const {
  openedPage,
  openedPageInSidebar,
  updateContent,
  openedPageWithParents,
  nestedUrl,
  fetchPage,
  openPage,
  openedPageId,
  isPublic,
  nestedPublicParentPage,
  isFetching,
  findPage,
  nestedPages,
} = useDocs()

const wrapperRef = ref<HTMLDivElement | undefined>()

const content = computed(() => openedPage.value?.content || '')

const breadCrumbs = computed(() => {
  const pagesBreadcrumbs = openedPageWithParents.value
    .map((page) => ({
      title: page.title,
      href: nestedUrl(page.id!),
      icon: page.icon,
      id: page.id,
    }))
    .reverse()
  return [...pagesBreadcrumbs]
})

const editor = useEditor({
  extensions: tiptapExtensions(),
  onUpdate: ({ editor }) => {
    if (!openedPage.value) return

    openedPage.value.content = editor.getHTML()
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

const removeNewFlagFromNewPage = (pageId: string) => {
  const page = findPage(nestedPages.value, pageId)
  if (page?.new) {
    page.new = false
  }
}

watch(
  () => content.value,
  () => {
    if (!editor.value) return

    if (content.value !== editor.value?.getHTML()) {
      const selection = editor.value.view.state.selection
      editor.value.chain().setContent(content.value).setTextSelection(selection.to).run()
    }
  },
)

watchDebounced(
  () => [openedPage.value?.id, openedPage.value?.content],
  ([newId, newContent], [oldId, oldContent]) => {
    if (!isPublic.value && openedPage.value?.id && newId === oldId && newContent !== oldContent) {
      updateContent({ pageId: openedPage.value?.id, content: openedPage.value!.content })
    }
  },
  {
    debounce: 300,
    maxWait: 600,
  },
)

watch(
  openedPageId,
  async (_, oldId) => {
    if (!openedPageId.value) return
    if (openedPage.value?.new) return

    if (oldId) removeNewFlagFromNewPage(oldId)

    isFetching.value.page = true
    openedPage.value = undefined

    const newPage = (await fetchPage()) as any
    if (newPage?.id !== openedPageId.value) return

    openedPage.value = newPage

    isFetching.value.page = false
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <a-layout-content>
    <div ref="wrapperRef" class="nc-docs-page h-full flex flex-row relative">
      <div class="flex flex-col w-full">
        <div class="flex flex-row justify-between items-center pl-6 pt-2.5">
          <div class="flex flex-row h-6">
            <template
              v-if="!isFetching.nestedPages &&(!isPublic || (project.meta as any)?.isPublic || nestedPublicParentPage?.is_nested_published)"
            >
              <div v-for="({ href, title, icon, id }, index) of breadCrumbs" :key="id" class="flex">
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
        </div>
        <div
          :key="openedPageId"
          class="mx-auto pr-6 pt-16 flex flex-col"
          :style="{
            width: '64rem',
            maxWidth: '45vw',
          }"
        >
          <a-skeleton-input
            v-if="isFetching.page && !isPublic"
            :active="true"
            size="large"
            class="docs-page-title-skelton !mt-4 !max-w-156 mb-3 -ml-3"
          />
          <DocsPageTitle v-else-if="openedPage" @focus-editor="focusEditor" />
          <div class="flex !mb-6"></div>

          <DocsPageSelectedBubbleMenu v-if="editor" :editor="editor" />
          <DocsPageLinkOptions v-if="editor" :editor="editor" />
          <a-skeleton-input
            v-if="isFetching.page && !isPublic"
            :active="true"
            size="small"
            class="docs-page-title-skelton !max-w-102 mb-3 mt-1 -ml-3"
          />
          <EditorContent
            v-else
            :editor="editor"
            class="px-2"
            :class="{
              '-ml-1': isPublic,
              '-ml-12.5': !isPublic,
            }"
          />
          <div
            v-if="(openedPageInSidebar?.children ?? []).length > 0 && !isFetching.page"
            class="flex flex-col py-12 border-b-1 border-t-1 border-gray-200 mt-12 mb-4 gap-y-6 pop-in-animation"
          >
            <div
              v-for="page of openedPageInSidebar?.children"
              :key="page.id"
              class="flex flex-row items-center gap-x-2 cursor-pointer text-gray-600 hover:text-black"
              @click="openPage(page)"
            >
              <MdiFileDocumentOutline class="flex pop-in-animation" />
              <div class="font-semibold text-base pop-in-animation">
                {{ page.title }}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="sticky top-0 pt-1.5 flex flex-col mr-3">
        <DocsPageOutline v-if="openedPage" :wrapper-ref="wrapperRef" />
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

.docs-page-title-skelton {
  .ant-skeleton-input {
    @apply !rounded-md;
  }
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

  p.is-empty::before,
  h1.is-empty::before,
  h2.is-empty::before,
  h3.is-empty::before {
    content: attr(data-placeholder);
    float: left;
    color: #afafaf;
    pointer-events: none;
    height: 0;
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
