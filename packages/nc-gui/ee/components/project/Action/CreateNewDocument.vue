<script setup lang="ts">
const props = defineProps<{
  baseId?: string
}>()

const { t } = useI18n()

const { isUIAllowed } = useRoles()

const { isSharedBase } = storeToRefs(useBase())

const { appInfo } = useGlobal()

const { isEEFeatureBlocked, showUpgradeForEEFeature } = useEeConfig()

const documentsStore = useDocumentsStore()
const { createDocument } = documentsStore

const isActionVisible = computed(() => {
  return !isSharedBase.value && isUIAllowed('documentCreate')
})

async function onCreateDocument() {
  if (!appInfo.value?.ee) {
    showUpgradeForEEFeature(t('objects.documents'))
    return
  }

  if (!props.baseId) return
  await createDocument(props.baseId)
}
</script>

<template>
  <div v-if="isActionVisible" class="relative">
    <ProjectActionItem
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
    <LazyPaymentUpgradeBadge :feature-enabled-callback="() => !isEEFeatureBlocked" class="absolute right-2 top-2" remove-click />
  </div>
</template>
