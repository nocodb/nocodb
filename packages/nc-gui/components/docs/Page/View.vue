<script lang="ts" setup>
import { EditorContent, FloatingMenu, useEditor } from '@tiptap/vue-3'
import { useSubheading } from './utils'
import tiptapExtensions from '~~/utils/tiptapExtensions'
import AlignRightIcon from '~icons/tabler/align-right'
import type { PageSidebarNode } from '~~/lib'

const isPublic = inject(IsDocsPublicInj, ref(false))

const {
  openedPage: openedPageInternal,
  openedBook,
  updateContent,
  openedNestedPagesOfBook,
  nestedUrl,
  bookUrl,
  fetchPage,
  openPage,
} = useDocs()

const { showPageSubHeadings, pageSubHeadings, selectActiveSubHeading, populatedPageSubheadings } = useSubheading()

// Page opened in the Page component, which is updated to the server debounce-ly
// The main reason we have it as a separate state, is since update syncing with server is debounced
// We will run into syncing issue if we use `openedPage`from `useDocs`, which is synced with server directly,
const localPage = ref<PageSidebarNode | undefined>()

provide(DocsLocalPageInj, localPage)

const isLoading = ref(false)

const content = computed(() => localPage.value?.content || '')

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
  extensions: tiptapExtensions(),
  onUpdate: ({ editor }) => {
    if (!localPage.value) return

    localPage.value.content = editor.getHTML()

    populatedPageSubheadings()
    selectActiveSubHeading()
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
  ([newId], [oldId]) => {
    if (!isPublic.value && localPage.value?.id && newId === oldId) {
      updateContent({ pageId: localPage.value?.id, content: localPage.value!.content })
    }
  },
  {
    debounce: 300,
    maxWait: 600,
  },
)

watch(
  () => localPage.value?.id,
  async () => {
    isLoading.value = true
    localPage.value = (await fetchPage({ page: localPage.value! })) as any

    if (openedPageInternal.value?.new) localPage.value!.new = true

    isLoading.value = false
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <a-layout-content>
    <div v-if="localPage" class="nc-docs-page h-full flex flex-row relative" @scroll="selectActiveSubHeading">
      <div class="flex flex-col w-full">
        <div class="flex flex-row justify-between items-center pl-8 pt-2.5">
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
          class="mx-auto pr-6 pt-16 flex flex-col"
          :style="{
            width: '54rem',
            maxWidth: '40vw',
          }"
        >
          <DocsPageTitle v-if="localPage" @focus-editor="focusEditor" />

          <DocsPageSelectedBubbleMenu v-if="editor" :editor="editor" />
          <FloatingMenu v-if="editor" :editor="editor" :tippy-options="{ duration: 100, placement: 'left' }">
            <MdiPlus
              class="hover:cursor-pointer hover:bg-gray-50 rounded-md"
              :class="{
                'mr-8': editor?.isActive('infoCallout') || editor?.isActive('tipCallout') || editor?.isActive('warningCallout'),
              }"
              @click="editor!.chain().focus().insertContent('/').run()"
            />
          </FloatingMenu>
          <EditorContent
            v-if="!isLoading"
            :editor="editor"
            class="px-2"
            :class="{
              '-ml-1': isPublic,
              '-ml-12.5': !isPublic,
            }"
          />
          <div
            v-if="!isLoading && openedPageInternal?.children?.length !== 0"
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
        <template v-if="pageSubHeadings.length > 0">
          <div class="flex flex-row justify-end cursor-pointer rounded-md">
            <div
              class="flex p-1 cursor-pointer rounded-md"
              :class="{
                'bg-gray-100 hover:bg-gray-200': showPageSubHeadings,
                'bg-white hover:bg-gray-100': !showPageSubHeadings,
              }"
              @click="showPageSubHeadings = !showPageSubHeadings"
            >
              <AlignRightIcon />
            </div>
          </div>
          <div v-if="showPageSubHeadings" class="pt-20 mr-24 flex flex-col w-full w-54">
            <div class="mb-2 text-gray-400 text-xs font-semibold">Content</div>
            <a
              v-for="(subHeading, index) in pageSubHeadings"
              :key="index"
              :href="`#${subHeading.text}`"
              class="flex py-1 !hover:text-primary !underline-transparent max-w-full break-all"
              :class="{
                'font-semibold text-primary': subHeading.active,
                '!text-gray-700': !subHeading.active,
                'ml-2.5': subHeading.type === 'h2',
                'ml-5': subHeading.type === 'h3',
              }"
            >
              {{ subHeading.text }}
            </a>
          </div>
        </template>
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

  .draggable-block-wrapper.selected {
    th,
    tr {
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
    td,
    th,
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
    margin-top: 0.25em;
    margin-bottom: 1em;
  }

  h3 {
    font-size: 1.35rem;
    margin-top: 0.3em;
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
    margin-top: 0.85rem;
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
