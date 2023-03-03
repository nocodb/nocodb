<script lang="ts" setup>
import { Icon as IconifyIcon } from '@iconify/vue'

const emit = defineEmits(['focusEditor'])

const { updatePage, isPublic, openedPage } = useDocs()

const titleInputRef = ref<HTMLInputElement>()

const title = computed({
  get: () => (openedPage.value!.new ? '' : openedPage.value?.title || ''),
  set: (value) => {
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
    await updatePage({ pageId: openedPage.value!.id!, page: { icon } })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

watchDebounced(
  () => [openedPage.value?.id, openedPage.value?.title],
  async ([oldPageId, oldPageTitle], [newPageId, newPageTitle]) => {
    if (isPublic.value) return
    if (!openedPage.value) return

    if (oldPageId !== newPageId) return
    if (oldPageTitle === newPageTitle) return

    await updatePage({ pageId: openedPage.value!.id!, page: { title: openedPage.value?.title } as any })
  },
  {
    debounce: 100,
    maxWait: 300,
  },
)

watch(
  titleInputRef,
  () => {
    if (!openedPage.value?.new) {
      return
    }

    titleInputRef.value?.focus()
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <div class="flex flex-row">
    <a-dropdown v-if="!isPublic && openedPage?.icon" placement="bottom" trigger="click">
      <div class="flex flex-col justify-center h-16 ml-2 px-2 text-gray-500 rounded-md hover:bg-gray-100 cursor-pointer">
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
      <div v-if="openedPage?.icon" class="flex flex-col justify-center h-16">
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
      class="!text-5xl font-semibold !px-1.5"
      :bordered="false"
      :readonly="isPublic"
      :placeholder="openedPage?.title"
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
