<script setup lang="ts">
const { t } = useI18n()

const { isUIAllowed } = useRoles()

const automationStore = useAutomationStore()

const { openNewScriptModal: _openNewScriptModal } = automationStore

const { openedProject } = storeToRefs(useBases())

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
</script>

<template>
  <ProjectActionItem
    v-if="isUIAllowed('scriptCreateOrEdit')"
    class="nc-base-view-all-scripts-btn"
    :label="label"
    data-testid="proj-view-btn__add-new-script"
    @click="openNewScriptModal"
  >
    <template #icon>
      <GeneralIcon icon="addOutlineBox" class="!h-8 !w-8 !text-brand-500" />
    </template>
  </ProjectActionItem>
</template>
