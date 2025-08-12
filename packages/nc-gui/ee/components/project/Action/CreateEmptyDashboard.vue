<script setup lang="ts">
const { t } = useI18n()

const dashboardStore = useDashboardStore()

const { isDashboardEnabled } = storeToRefs(dashboardStore)

const { openNewDashboardModal: _openNewDashboardModal } = dashboardStore

const { openedProject } = storeToRefs(useBases())

const { isSharedBase } = storeToRefs(useBase())

const label = computed(() => {
  return `${t('general.create')} ${t('general.empty')} ${t('objects.dashboard')}`
})

async function openNewDashboardModal() {
  _openNewDashboardModal({
    baseId: openedProject.value?.id,
    loadBasesOnClose: true,
    scrollOnCreate: true,
  })
}

const isActionVisible = computed(() => {
  return isDashboardEnabled.value && !isSharedBase.value
})
</script>

<template>
  <ProjectActionItem
    v-if="isActionVisible"
    class="nc-base-view-all-dashboards-btn"
    :label="label"
    :subtext="$t('msg.subText.startFromScratch')"
    data-testid="proj-view-btn__add-new-dashboard"
    @click="openNewDashboardModal"
  >
    <template #icon>
      <GeneralIcon icon="dashboards" class="!h-8 !w-8 !text-nc-content-brand" />
    </template>
  </ProjectActionItem>
</template>
