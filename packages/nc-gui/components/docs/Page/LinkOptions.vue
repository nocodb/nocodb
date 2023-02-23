<script lang="ts" setup>
import { defineProps } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3'
import { getMarkRange } from '@tiptap/core'
import type { Mark } from 'prosemirror-model'

const { editor } = defineProps<Props>()
const { flattenedNestedPages, nestedSlugsFromPageId, nestedUrl } = useDocs()
interface Props {
  editor: Editor
}

const linkNodeMark = ref<Mark | undefined>()
const href = ref('')

const filteredPages = computed(() => {
  if (href.value === '') return []

  return flattenedNestedPages.value.filter((page) => {
    const pagePath = page.title.toLowerCase()
    const hrefPath = href.value.toLowerCase()
    return pagePath.includes(hrefPath) || hrefPath.includes(pagePath)
  })
})

const isHrefError = computed(() => {
  const isHrefEmpty = href.value === ''
  const validUrlRegex = /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g
  const isHrefInvalid = !isHrefEmpty && !validUrlRegex.test(href.value)
  return !isHrefEmpty && isHrefInvalid
})

// This is used to prevent the menu from showing up after a link is deleted, an edge case when the link with empty placeholder text is deleted.
// This is because checkLinkMark is not called in that case
const justDeleted = ref(false)

// This function is called by BubbleMenu on selection change
// It is used to check if the link mark is active and only show the menu if it is
const checkLinkMark = (editor: Editor) => {
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
  return isActiveNodeMarkActive && !isTextSelected
}

const onChange = () => {
  const isLinkMarkedStoredInEditor = editor?.state?.storedMarks?.some((mark: Mark) => mark.type.name === 'link')

  if (isLinkMarkedStoredInEditor) {
    editor.view.dispatch(
      editor.view.state.tr
        .removeStoredMark(editor?.schema.marks.link)
        .addStoredMark(editor?.schema.marks.link.create({ href: href.value })),
    )
  } else if (linkNodeMark.value) {
    const selection = editor?.state?.selection
    const markSelection = getMarkRange(selection.$anchor, editor?.schema.marks.link) as any

    editor.view.dispatch(
      editor.view.state.tr
        .removeMark(markSelection.from, markSelection.to, editor?.schema.marks.link)
        .addMark(markSelection.from, markSelection.to, editor?.schema.marks.link.create({ href: href.value })),
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
  href.value = `/#${nestedUrl(page.id)}`

  onChange()

  editor.chain().focus().insertContent(page.title).run()
}
</script>

<template>
  <BubbleMenu :editor="editor" :tippy-options="{ duration: 100, maxWidth: 600 }" :should-show="(checkLinkMark as any)">
    <div
      v-if="!justDeleted"
      class="relative bubble-menu flex flex-col bg-gray-50 py-1 px-1"
      :class="{
        'rounded-lg': filteredPages.length === 0,
        'rounded-t-lg': filteredPages.length > 0,
      }"
    >
      <div class="flex items-center gap-x-1">
        <div class="!border-1 !border-gray-200 mx-1 my-1 !py-0.5 bg-gray-100 rounded-md">
          <a-input
            v-model:value="href"
            class="flex-1 !w-96 !mx-1 !rounded-md"
            :bordered="false"
            placeholder="https://"
            @change="onChange"
          />
          <IcBaselineErrorOutline v-if="isHrefError" class="mr-2 text-red-500 mb-0.5" />
          <MdiLinkVariant v-else class="mr-2 text-gray-400 mb-0.5" />
        </div>
        <div class="flex mr-0.5 p-1.5 rounded-md cursor-pointer !hover:bg-gray-200 hover:text-red-400" @click="onDelete">
          <MdiDeleteOutline />
        </div>
        <div class="absolute -bottom-1.5 left-0 right-0 w-full flex flex-row justify-center">
          <div
            class="flex h-2.5 w-2.5 bg-gray-50 border-gray-100 border-r-1 border-b-1"
            :style="{ transform: 'rotate(45deg)' }"
          ></div>
        </div>
      </div>
      <div v-if="filteredPages.length > 0" class="absolute w-full -bottom-62 mt-4 left-0 h-64">
        <div class="bubble-menu flex flex-col -bottom-22 space-y-1 bg-gray-50 w-full px-2 rounded-b-lg py-2">
          <div
            v-for="(page, index) of filteredPages"
            :key="index"
            class="py-2 px-3.5 flex flex-row gap-x-3 items-center rounded-md hover:bg-gray-200 cursor-pointer"
            @click="() => onPageClick(page)"
          >
            <MdiFileDocumentOutline />
            <div class="flex flex-col">
              <div class="flex">
                {{ page.title }}
              </div>
              <div class="flex text-xs text-gray-400">
                {{ nestedSlugsFromPageId(page.id!).join('/') }}
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
</style>
