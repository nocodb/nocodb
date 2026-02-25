<script setup lang="ts">
const props = defineProps<{
  baseId?: string
}>()

const { isUIAllowed } = useRoles()

const { isSharedBase } = storeToRefs(useBase())

const docsStore = useDocsStore()
const { createDoc } = docsStore

const isActionVisible = computed(() => {
  return !isSharedBase.value && isUIAllowed('docCreate')
})

async function onCreatePage() {
  if (!props.baseId) return
  await createDoc(props.baseId)
}
</script>

<template>
  <ProjectActionItem
    v-if="isActionVisible"
    class="nc-base-view-all-pages-btn"
    :label="$t('dashboards.create_new_page')"
    :subtext="$t('msg.subText.startFromScratch')"
    data-testid="proj-view-btn__add-new-page"
    @click="onCreatePage"
  >
    <template #icon>
      <GeneralIcon icon="ncFileText" class="!h-8 !w-8 !text-nc-content-brand" />
    </template>
  </ProjectActionItem>
</template>
