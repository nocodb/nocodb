<script setup lang="ts">
const { t } = useI18n()

const dashboardStore = useDashboardStore()

const { openNewDashboardModal: _openNewDashboardModal } = dashboardStore

const { openedProject } = storeToRefs(useBases())

const { isSharedBase } = storeToRefs(useBase())

const { isEEFeatureBlocked, showUpgradeForEEFeature } = useEeConfig()

const label = computed(() => {
  return `${t('general.create')} ${t('objects.dashboard')}`
})

async function openNewDashboardModal() {
  if (isEEFeatureBlocked.value) {
    showUpgradeForEEFeature(t('objects.dashboards'))
    return
  }

  _openNewDashboardModal({
    baseId: openedProject.value?.id,
    loadBasesOnClose: true,
    scrollOnCreate: true,
  })
}

const isActionVisible = computed(() => {
  return !isSharedBase.value
})
</script>

<template>
  <div v-if="isActionVisible" class="relative">
    <ProjectActionItem
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
    <LazyPaymentUpgradeBadge :feature-enabled-callback="() => !isEEFeatureBlocked" class="absolute right-2 top-2" remove-click />
  </div>
</template>
