<script setup lang="ts">
import { PlanFeatureTypes } from 'nocodb-sdk'

const props = defineProps<{
  baseId?: string
}>()

const { isUIAllowed } = useRoles()

const { isSharedBase, isSandbox } = storeToRefs(useBase())

const { blockDocs, showUpgradeToUseDocs } = useEeConfig()

const documentsStore = useDocumentsStore()
const { createDocument } = documentsStore

const isActionVisible = computed(() => {
  return !isSharedBase.value && !isSandbox.value && isUIAllowed('documentCreate')
})

async function onCreateDocument() {
  if (blockDocs.value) {
    showUpgradeToUseDocs({ triggerSource: 'create-docs' })
    return
  }

  if (!props.baseId) return
  await createDocument(props.baseId)
}
</script>

<template>
  <div v-if="isActionVisible" class="relative flex items-stretch">
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
    <LazyPaymentUpgradeBadge
      :feature="PlanFeatureTypes.FEATURE_DOCS"
      :feature-enabled-callback="() => !blockDocs"
      class="absolute right-2 top-2"
      remove-click
    />
  </div>
</template>
