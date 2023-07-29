<script lang="ts" setup>
// If title is provided as prop, use it. Otherwise use the title from the store
const props = defineProps<{
  title?: string | undefined
}>()

const emit = defineEmits(['insertEmptyEditorTop', 'focusEditor'])

const { title: propTitle } = props

const MAX_TITLE_LENGTH = 150

const { project } = useProject()

const { openedPage, isEditAllowed, isPageFetching } = storeToRefs(useDocStore())

const { updatePage } = useDocStore()

const titleInputRef = ref<HTMLInputElement>()

const _title = ref<string | undefined>(undefined)
const title = computed({
  get: () => propTitle || _title.value,
  set: (value) => {
    if (value === undefined) return

    if (value.length > MAX_TITLE_LENGTH) {
      value = value?.slice(0, MAX_TITLE_LENGTH)
    }

    _title.value = value

    openedPage.value = { ...openedPage.value!, title: value }
  },
})

const onTitleKeyDown = (e: KeyboardEvent) => {
  // Ctrl/Cmd + A
  if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    const range = document.createRange()
    range.selectNodeContents(e.target as Node)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }
  // Down arrow
  else if (e.key === 'ArrowDown') {
    // get cursor position
    const cursorPosition = window.getSelection()
    if (cursorPosition?.anchorOffset === title.value?.length) {
      emit('focusEditor')
    }
  } else if (e.key === 'Enter') {
    e.preventDefault()
    emit('insertEmptyEditorTop')
  } else if (e.key === 'Backspace' || e.key === 'Delete') {
    const textSelection = window.getSelection()?.toString()

    // TODO: Hack. Bug with ant text area. Does not delete all text when all text is selected
    if (textSelection?.length === title.value?.length) {
      e.preventDefault()
      title.value = ''
      _title.value = ''
    }
  }
}

const onTitleInput = (e: Event) => {
  if (!titleInputRef.value) return

  title.value = (e.target as HTMLInputElement).innerText

  const position = window.getSelection()?.anchorOffset
  // Set cursor position as in safari cursor is put start of the text when typing
  if (position !== null && position !== undefined) {
    nextTick(() => {
      const range = document.createRange()

      const sel = window.getSelection()
      if (sel) {
        range.setStart(titleInputRef.value!.childNodes[0] as Node, position)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
      }
    })
  }
}

const setIcon = async (icon: string) => {
  try {
    openedPage.value!.icon = icon
    await updatePage({ pageId: openedPage.value!.id!, page: { icon }, projectId: project.id! })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const focusTitle = () => {
  nextTick(() => {
    titleInputRef.value?.focus()
  })
}

watch(title, async (newTitle, oldTitle) => {
  if (!isEditAllowed.value) return
  if (!openedPage.value) return
  if (oldTitle === undefined) return
  if (newTitle === oldTitle) return

  await updatePage({ pageId: openedPage.value!.id!, page: { title: openedPage.value?.title } as any, projectId: project.id! })
})

// TODO: Hack. Due to some rerendering issues, we need to focus title after some time
watch(
  isPageFetching,
  (isFetching) => {
    if (!isFetching && openedPage.value?.title.length === 0) {
      for (let i = 0; i < 6; i++) {
        setTimeout(() => {
          focusTitle()
        }, i * 100)
      }
    }
  },
  {
    immediate: true,
  },
)

onMounted(() => {
  title.value = openedPage.value!.title
})
</script>

<template>
  <div
    class="flex flex-row gap-x-2 items-end ml-7.15 mb-3.5 nc-page-title-wrapper"
    :class="{
      empty: title?.length === 0,
    }"
    data-testid="docs-page-title-wrapper"
  >
    <GeneralEmojiPicker
      v-if="openedPage?.icon"
      :key="openedPage.icon"
      :emoji="openedPage.icon"
      :readonly="!isEditAllowed"
      size="xlarge"
      @emoji-selected="setIcon"
    >
      <template #default>
        <MdiFileDocumentOutline class="text-gray-600 text-sm" />
      </template>
    </GeneralEmojiPicker>
    <div
      ref="titleInputRef"
      :contenteditable="isEditAllowed && !propTitle"
      data-testid="docs-page-title"
      class="nc-docs-page-title w-full"
      :readonly="!isEditAllowed || !!propTitle"
      @input="onTitleInput"
      @keydown="onTitleKeyDown"
    >
      {{ title }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-page-title-wrapper.empty {
  .nc-docs-page-title::after {
    content: 'Untitled' !important;
    float: left;
    color: #afafaf;
    pointer-events: none;
    margin-left: 0.05rem;
  }
}
</style>
