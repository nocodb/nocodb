<script setup lang="ts">
const panelStore = useExpandedFormPanelOrThrow()

const { activityExpanded, activeActivityTab, activeRowId } = panelStore

const expandedFormStore = useExpandedFormStoreOrThrow()

const { loadAudits } = expandedFormStore

watch(
  () => activityExpanded.value && activeActivityTab.value === 'audits',
  async (shouldLoadAudits) => {
    if (shouldLoadAudits && activeRowId.value) {
      await loadAudits(activeRowId.value, false)
    }
  },
)
</script>

<template>
  <div v-if="activityExpanded" class="nc-expanded-form-panel-activity flex flex-col flex-shrink-0 border-t border-nc-border-gray-medium">
    <div class="nc-expanded-form-panel-activity-content flex-1 min-h-0 overflow-hidden">
      <SmartsheetExpandedFormSidebarComments v-if="activeActivityTab === 'comments'" />
      <SmartsheetExpandedFormSidebarAudits v-else-if="activeActivityTab === 'audits'" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-expanded-form-panel-activity {
  max-height: 45%;
}

.nc-expanded-form-panel-activity-content {
  @apply h-[250px];
}
</style>
