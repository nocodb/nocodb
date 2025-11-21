<script setup lang="ts">
const { t } = useI18n()

const { isUIAllowed } = useRoles()

const workflowStore = useWorkflowStore()

const { openNewWorkflowModal: _openNewWorkflowModal } = workflowStore

const { openedProject } = storeToRefs(useBases())

const { isSharedBase } = storeToRefs(useBase())

const label = computed(() => {
  return `${t('general.create')} ${t('general.empty')} ${t('objects.workflow')}`
})

async function openNewWorkflowModal() {
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
  <ProjectActionItem
    v-if="isActionVisible"
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
</template>
