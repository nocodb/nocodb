<script lang="ts" setup>
const emit = defineEmits(['focusEditor'])

const isPublic = inject(IsDocsPublicInj, ref(false))
const localPage = inject(DocsLocalPageInj)!
const { updatePage } = useDocs()

const isTitleInputRefLoaded = ref(false)
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

// todo: Hack to focus on title when its edited since on editing title, route will changed, which will cause re render
watch(titleInputRef, (el) => {
  if (!isTitleInputRefLoaded.value && !localPage.value?.new) {
    isTitleInputRefLoaded.value = true
    return
  }

  isTitleInputRefLoaded.value = true
  el?.focus()
})
</script>

<template>
  <a-input
    ref="titleInputRef"
    v-model:value="title"
    class="!text-5xl font-semibold !px-1.5 !mb-6"
    :bordered="false"
    :readonly="isPublic"
    :placeholder="localPage?.title"
    auto-size
    @keydown="onTitleKeyDown"
  />
</template>
