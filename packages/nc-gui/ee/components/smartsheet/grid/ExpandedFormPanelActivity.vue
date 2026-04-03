<script setup lang="ts">
const panelStore = useExpandedFormPanelOrThrow()

const { activityExpanded, activeActivityTab } = panelStore
const { toggleActivity } = panelStore

const expandedFormStore = useExpandedFormStoreOrThrow()

const { loadAudits } = expandedFormStore

const { activeRowId } = panelStore

watch(
  () => activityExpanded.value && activeActivityTab.value === 'audits',
  async (shouldLoadAudits) => {
    if (shouldLoadAudits && activeRowId.value) {
      await loadAudits(activeRowId.value, false)
    }
  },
)

const { t } = useI18n()
</script>

<template>
  <div class="nc-expanded-form-panel-activity flex flex-col flex-shrink-0 border-t border-nc-border-gray-medium">
    <!-- Toggle bar -->
    <div class="flex items-center h-9 px-3 gap-1">
      <NcButton
        size="xs"
        :type="activityExpanded && activeActivityTab === 'comments' ? 'secondary' : 'text'"
        class="!text-xs"
        data-testid="nc-expanded-form-panel-comments-toggle"
        @click="toggleActivity('comments')"
      >
        <div class="flex items-center gap-1.5">
          <GeneralIcon icon="messageCircle" class="w-3.5 h-3.5" />
          {{ t('general.comments') }}
        </div>
      </NcButton>

      <NcButton
        size="xs"
        :type="activityExpanded && activeActivityTab === 'audits' ? 'secondary' : 'text'"
        class="!text-xs"
        data-testid="nc-expanded-form-panel-audits-toggle"
        @click="toggleActivity('audits')"
      >
        <div class="flex items-center gap-1.5">
          <GeneralIcon icon="audit" class="w-3.5 h-3.5" />
          {{ t('labels.revisionHistory') }}
        </div>
      </NcButton>

      <div class="flex-1" />

      <NcButton
        v-if="activityExpanded"
        size="xs"
        type="text"
        data-testid="nc-expanded-form-panel-activity-collapse"
        @click="toggleActivity()"
      >
        <GeneralIcon icon="chevronDown" class="w-4 h-4" />
      </NcButton>
    </div>

    <!-- Content -->
    <div
      v-if="activityExpanded"
      class="nc-expanded-form-panel-activity-content flex-1 min-h-0 overflow-hidden"
    >
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
