<script setup lang="ts">
const props = defineProps<{
  baseId?: string
}>()

const { isUIAllowed } = useRoles()

const { isSharedBase } = storeToRefs(useBase())

const documentsStore = useDocumentsStore()
const { createDocument } = documentsStore

const isActionVisible = computed(() => {
  return !isSharedBase.value && isUIAllowed('documentCreate')
})

async function onCreateDocument() {
  if (!props.baseId) return
  await createDocument(props.baseId)
}
</script>

<template>
  <ProjectActionItem
    v-if="isActionVisible"
    class="nc-base-view-all-pages-btn"
    :label="$t('dashboards.create_new_document')"
    :subtext="$t('msg.subText.startFromScratch')"
    data-testid="proj-view-btn__add-new-page"
    @click="onCreateDocument"
  >
    <template #icon>
      <GeneralIcon icon="ncFileText" class="!h-8 !w-8 !text-nc-content-brand" />
    </template>
  </ProjectActionItem>
</template>
