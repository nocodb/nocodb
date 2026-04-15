<script setup lang="ts">
const { t } = useI18n()

const { isUIAllowed } = useRoles()

const workflowStore = useWorkflowStore()

const { openNewWorkflowModal: _openNewWorkflowModal } = workflowStore

const { openedProject } = storeToRefs(useBases())

const { isSharedBase } = storeToRefs(useBase())

const { isEEFeatureBlocked, blockWorkflows, showUpgradeToUseWorkflows } = useEeConfig()

const label = computed(() => {
  return `${t('general.create')} ${t('objects.workflow')}`
})

async function openNewWorkflowModal() {
  if (blockWorkflows.value) {
    showUpgradeToUseWorkflows()
    return
  }

  _openNewWorkflowModal({
    baseId: openedProject.value?.id,
    loadWorkflowsOnClose: true,
    scrollOnCreate: true,
  })
}

const isActionVisible = computed(() => {
  return isUIAllowed('workflowCreateOrEdit') && !isSharedBase.value
})
</script>

<template>
  <div v-if="isActionVisible" class="relative">
    <ProjectActionItem
      class="nc-base-view-all-workflows-btn"
      :label="label"
      :subtext="$t('msg.subText.startFromScratch')"
      data-testid="proj-view-btn__add-new-workflow"
      @click="openNewWorkflowModal"
    >
      <template #icon>
        <GeneralIcon icon="ncAutomation" class="!h-8 !w-8 !text-nc-content-brand" />
      </template>
    </ProjectActionItem>
    <LazyPaymentUpgradeBadge :feature-enabled-callback="() => !isEEFeatureBlocked" class="absolute right-2 top-2" remove-click />
  </div>
</template>
