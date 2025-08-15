<script setup lang="ts">
const { t } = useI18n()

const { isUIAllowed } = useRoles()

const automationStore = useAutomationStore()

const { openNewScriptModal: _openNewScriptModal } = automationStore

const { openedProject } = storeToRefs(useBases())

const { isSharedBase } = storeToRefs(useBase())

const label = computed(() => {
  return `${t('general.create')} ${t('general.empty')} ${t('objects.script')}`
})

async function openNewScriptModal() {
  _openNewScriptModal({
    baseId: openedProject.value?.id,
    loadAutomationsOnClose: true,
    scrollOnCreate: true,
  })
}

const isActionVisible = computed(() => {
  return isUIAllowed('scriptCreateOrEdit') && !isSharedBase.value
})
</script>

<template>
  <ProjectActionItem
    v-if="isActionVisible"
    class="nc-base-view-all-scripts-btn"
    :label="label"
    :subtext="$t('msg.subText.startFromScratch')"
    data-testid="proj-view-btn__add-new-script"
    @click="openNewScriptModal"
  >
    <template #icon>
      <GeneralIcon icon="ncScript" class="!h-8 !w-8 !text-nc-content-brand" />
    </template>
  </ProjectActionItem>
</template>
