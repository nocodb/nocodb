<script lang="ts" setup>
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { Icon as IconifyIcon } from '@iconify/vue'
import { TiptapNodesTypes } from 'nocodb-sdk'
import { generateJSON } from '@tiptap/html'
import { useShortcuts } from '../utils'
import tiptapExtensions from '~~/utils/tiptapExtensions'
import AlignRightIcon from '~icons/tabler/align-right'
import { emptySectionContent, removeUploadingPlaceHolderAndEmptyLinkNode } from '~~/utils/tiptapExtensions/helper'
import '~/assets/docsPage.scss'

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

useDocHistoryStore()
const { currentSnapshot, isHistoryPaneOpen, prevSnapshot } = storeToRefs(useDocHistoryStore())
const { updatePage, nestedUrl, openPage } = useDocStore()

const isEditAllowed = computed(() => _isEditAllowed.value && !currentSnapshot.value)

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
    if (currentSnapshot.value) return

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

const insertEmptyEditorTop = () => {
  editor?.value?.chain().insertContentAt(0, [emptySectionContent]).focus().run()
}

const focusEditor = () => {
  editor?.value?.chain().focus('start').run()
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
    if (currentSnapshot.value) return

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

    const dragAreaPortion = 0.1

    if (y > viewportHeight - viewportHeight * dragAreaPortion) {
      const el = document.querySelector('.nc-docs-page')
      el?.scrollBy(0, 10)
    }

    // If add the top of viewport, scroll up
    if (y < viewportHeight * dragAreaPortion) {
      const el = document.querySelector('.nc-docs-page')
      el?.scrollBy(0, -10)
    }

    handleOutsideTiptapDrag(e, 'dragover')
  })

  wrapper.addEventListener('drop', (e) => handleOutsideTiptapDrag(e, 'drop'))
})

const focusOnFirstDiffedElement = () => {
  const diffedElements = document.querySelectorAll('.nc-docs-page [data-is-diff="true"]')
  if (diffedElements.length === 0) return

  const firstDiffedElement = diffedElements[0] as HTMLElement
  firstDiffedElement.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'center',
  })
}

watch(
  currentSnapshot,
  () => {
    if (!currentSnapshot.value) {
      setEditorContent(content.value)
      return
    }

    setEditorContent(currentSnapshot.value.diff, false, true)
    setTimeout(() => {
      focusOnFirstDiffedElement()
    }, 0)
  },
  {
    deep: true,
  },
)
</script>

<template>
  <a-layout-content>
    <div
      id="nc-docs-page-wrapper"
      ref="pageWrapperDomRef"
      data-testid="docs-opened-page"
      class="nc-docs-page-wrapper h-full flex flex-row relative"
    >
      <div
        class="flex flex-col w-full"
        :class="{
          readonly: !isEditAllowed,
          editable: isEditAllowed,
        }"
      >
        <div class="flex flex-row justify-between items-center pl-6 my-2 h-8">
          <div class="flex flex-row items-center">
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
              v-if="!isPublic"
              class="mt-0.25 p-1.75 flex items-center hover:bg-gray-100 cursor-pointer rounded-md mr-2"
              data-testid="nc-doc-page-history-button"
              :class="{
                'bg-gray-100': isHistoryPaneOpen,
              }"
              @click="isHistoryPaneOpen = !isHistoryPaneOpen"
            >
              <MaterialSymbolsHistoryRounded class="!h-4.5" />
            </div>
            <div class="">
              <LazyGeneralShareProject v-if="!currentSnapshot" />
              <DocsPageRestoreButton v-else />
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
        <div ref="pageContentDomRef" :key="String(isEditAllowed)" class="nc-docs-page relative pb-20">
          <DocsPageMutliSectionSelector
            v-if="isEditAllowed && editor && pageContentDomRef"
            :editor="editor"
            :selection-box="selectionBox"
            :page-content-dom-ref="pageContentDomRef"
            @update:selection-box="selectionBox = $event"
          />
          <div
            :key="openedPageId ?? currentSnapshot?.id ?? ''"
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
            <div
              v-else-if="openedPage && currentSnapshot && prevSnapshot && currentSnapshot!.page!.title !== prevSnapshot!.page!.title"
              class="flex flex-col"
            >
              <div class="py-2 mb-1 bg-red-200 rounded-sm">
                <DocsPageTitle
                  :key="currentSnapshot.id"
                  :data-is-diff="true"
                  class="docs-page-title"
                  :title="currentSnapshot.page!.title!"
                  @insert-empty-editor-top="insertEmptyEditorTop"
                  @focus-editor="focusEditor"
                />
              </div>
              <div class="py-2 bg-green-200 rounded-sm">
                <DocsPageTitle
                  :key="prevSnapshot.id"
                  :data-is-diff="true"
                  class="docs-page-title"
                  :title="prevSnapshot.page!.title!"
                  @insert-empty-editor-top="insertEmptyEditorTop"
                  @focus-editor="focusEditor"
                />
              </div>
            </div>
            <DocsPageTitle
              v-else-if="openedPage && currentSnapshot"
              :key="currentSnapshot.id"
              class="docs-page-title"
              :title="currentSnapshot.page!.title!"
              @insert-empty-editor-top="insertEmptyEditorTop"
              @focus-editor="focusEditor"
            />
            <DocsPageTitle
              v-else-if="openedPage"
              :key="openedPage.id"
              class="docs-page-title"
              @insert-empty-editor-top="insertEmptyEditorTop"
              @focus-editor="focusEditor"
            />

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
            <EditorContent
              v-else
              :key="isEditAllowed ? 'edit' : 'view'"
              data-testid="docs-page-content"
              :editor="editor"
              class="nc-docs-page-content"
            />
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
      <DocsPageHistory v-if="isHistoryPaneOpen" @close="isHistoryPaneOpen = false" />
    </div>
    <DocsPageOutline
      v-if="showOutline && openedPage && pageContentDomRef"
      :key="openedPage.id"
      :wrapper-ref="pageContentDomRef"
    />
  </a-layout-content>
</template>
