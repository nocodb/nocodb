<script lang="ts" setup>
import { Icon as IconifyIcon } from '@iconify/vue'

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

    openedPage.value = { ...openedPage.value!, title: value, new: false }
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
  title.value = (e.target as HTMLInputElement).innerText
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
  if (!oldTitle) return
  if (newTitle === oldTitle) return

  await updatePage({ pageId: openedPage.value!.id!, page: { title: openedPage.value?.title } as any, projectId: project.id! })
})

// TODO: Hack. Due to some rerendering issues, we need to focus title after some time
watch(
  isPageFetching,
  (isFetching) => {
    if (!isFetching && openedPage.value?.new) {
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
  if (openedPage.value?.new) {
    // So that we do not reset `new` flag of opened page to false
    _title.value = ''
  } else {
    title.value = openedPage.value!.title
  }
})
</script>

<template>
  <div
    class="flex flex-row gap-x-2 items-end ml-7.5 mb-3.5 nc-page-title-wrapper"
    :class="{
      empty: title?.length === 0,
    }"
    data-testid="docs-page-title-wrapper"
  >
    <a-dropdown v-if="isEditAllowed && openedPage?.icon" placement="bottom" trigger="click">
      <div
        class="flex flex-col justify-center h-16 px-2 text-gray-500 rounded-md hover:bg-gray-100 cursor-pointer"
        data-testid="nc-doc-opened-page-icon-picker"
      >
        <IconifyIcon
          v-if="openedPage?.icon"
          :key="openedPage.icon"
          :data-testid="`nc-doc-page-icon-${openedPage.icon}`"
          class="text-5xl"
          :icon="openedPage.icon"
        ></IconifyIcon>
      </div>
      <template #overlay>
        <div class="flex p-1 bg-gray-50 rounded-md">
          <GeneralEmojiIcons class="shadow bg-white p-2" @select-icon="setIcon($event)" />
        </div>
      </template>
    </a-dropdown>
    <template v-else>
      <div v-if="openedPage?.icon" class="flex flex-col justify-center h-16 pl-2 pr-2">
        <IconifyIcon
          v-if="openedPage?.icon"
          :key="openedPage.icon"
          :data-testid="`nc-doc-page-icon-${openedPage.icon}`"
          class="flex text-5xl"
          :icon="openedPage.icon"
        ></IconifyIcon>
      </div>
    </template>
    <div
      ref="titleInputRef"
      :contenteditable="isEditAllowed && !propTitle"
      data-testid="docs-page-title"
      class="nc-docs-page-title"
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
    content: 'Title' !important;
    float: left;
    color: #afafaf;
    pointer-events: none;
    margin-left: 0.05rem;
  }
}
</style>
