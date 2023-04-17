<script lang="ts" setup>
import { Icon as IconifyIcon } from '@iconify/vue'

const emit = defineEmits(['focusEditor'])

const MAX_TITLE_LENGTH = 150

const { project } = useProject()

const { openedPage, isPublic, isEditAllowed, isPageFetching } = storeToRefs(useDocStore())

const { updatePage } = useDocStore()

const titleInputRef = ref<HTMLInputElement>()

const _title = ref<string | undefined>(undefined)
const title = computed({
  get: () => _title.value,
  set: (value) => {
    if (!value) return

    if (value.length > MAX_TITLE_LENGTH) {
      value = value?.slice(0, MAX_TITLE_LENGTH)
    }

    _title.value = value

    openedPage.value = { ...openedPage.value!, title: value, new: false }
  },
})

const onTitleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    emit('focusEditor')
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
    class="flex flex-row gap-x-2 items-end"
    :class="{
      'ml-6.5': !isPublic,
      'ml-0.75': isPublic,
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
    <a-textarea
      ref="titleInputRef"
      v-model:value="title"
      data-testid="docs-page-title"
      class="!text-5xl font-semibold !p-0"
      :bordered="false"
      :readonly="!isEditAllowed"
      placeholder="Title"
      auto-size
      @keydown="onTitleKeyDown"
    />
  </div>
</template>

<style lang="scss" scoped>
textarea {
  overflow-y: hidden;
  line-height: 125% !important;
}
</style>
