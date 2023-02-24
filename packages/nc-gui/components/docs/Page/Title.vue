<script lang="ts" setup>
import { Icon as IconifyIcon } from '@iconify/vue'

const emit = defineEmits(['focusEditor'])

const isPublic = inject(IsDocsPublicInj, ref(false))
const localPage = inject(DocsLocalPageInj)!
const { updatePage } = useDocs()

const titleInputRef = ref<HTMLInputElement>()

const title = computed({
  get: () => (localPage.value!.new ? '' : localPage.value?.title || ''),
  set: (value) => {
    localPage.value = { ...localPage.value!, title: value, new: false }
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
    localPage.value!.icon = icon
    await updatePage({ pageId: localPage.value!.id!, page: { icon } })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

watchDebounced(
  () => [localPage.value?.id, localPage.value?.title],
  async ([newId, newTitle], [oldId, oldTitle]) => {
    if (newId === oldId && newTitle && newTitle.length > 0 && newTitle !== oldTitle) {
      await updatePage({ pageId: newId!, page: { title: newTitle } as any })
    }
  },
  {
    debounce: 100,
    maxWait: 300,
  },
)

watch(
  titleInputRef,
  () => {
    if (!localPage.value?.new) {
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
    <a-dropdown v-if="!isPublic && localPage?.icon" placement="bottom" trigger="click">
      <div class="flex flex-col justify-center h-16 ml-2 px-2 text-gray-500 rounded-md hover:bg-gray-100 cursor-pointer">
        <IconifyIcon
          v-if="localPage?.icon"
          :key="localPage.icon"
          :data-testid="`nc-doc-page-icon-${localPage.icon}`"
          class="text-5xl"
          :icon="localPage.icon"
        ></IconifyIcon>
      </div>
      <template #overlay>
        <div class="flex p-1 bg-gray-50 rounded-md">
          <GeneralEmojiIcons class="shadow bg-white p-2" @select-icon="setIcon($event)" />
        </div>
      </template>
    </a-dropdown>
    <a-textarea
      ref="titleInputRef"
      v-model:value="title"
      class="!text-5xl font-semibold !px-1.5 !mb-6"
      :bordered="false"
      :readonly="isPublic"
      :placeholder="localPage?.title"
      auto-size
      @keydown="onTitleKeyDown"
    />
  </div>
</template>
