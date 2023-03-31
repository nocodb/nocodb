<script lang="ts" setup>
import { Icon as IconifyIcon } from '@iconify/vue'

const emit = defineEmits(['focusEditor'])

const MAX_TITLE_LENGTH = 150

const { project } = useProject()

const { openedPage, isPublic, isEditAllowed } = storeToRefs(useDocStore())

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

onMounted(() => {
  if (openedPage.value?.new) {
    // So that we do not reset `new` flag of opened page to false
    _title.value = ''
  } else {
    title.value = openedPage.value!.title
  }

  if (openedPage.value?.new) {
    focusTitle()
  }
})
</script>

<template>
  <div
    class="flex flex-row gap-x-2"
    :class="{
      'ml-7': !isPublic,
      '-ml-0.5': isPublic,
    }"
  >
    <a-dropdown v-if="isEditAllowed && openedPage?.icon" placement="bottom" trigger="click">
      <div class="flex flex-col justify-center h-16 px-2 text-gray-500 rounded-md hover:bg-gray-100 cursor-pointer">
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
      :readonly="isPublic"
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
