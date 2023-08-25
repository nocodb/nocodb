<script setup lang="ts">
const { openedViewsTab } = storeToRefs(useViewsStore())
const { onViewsTabChange } = useViewsStore()

const { isUIAllowed } = useUIPermission()

const openedSubTab = computed({
  get() {
    return openedViewsTab.value
  },
  set(val) {
    onViewsTabChange(val)
  },
})

watch(
  openedSubTab,
  () => {
    if (openedSubTab.value === 'webhook' && !isUIAllowed('hookList')) {
      onViewsTabChange('relation')
    }
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <div class="flex flex-col h-full w-full" data-testid="nc-details-wrapper">
    <NcTabs v-model="openedSubTab">
      <a-tab-pane key="relation">
        <template #tab>
          <div class="tab" data-testid="nc-relations-tab">
            <GeneralIcon icon="erd" class="tab-icon" :class="{}" />
            <div>Relations</div>
          </div>
        </template>
        <SmartsheetDetailsErd />
      </a-tab-pane>

      <a-tab-pane key="api">
        <template #tab>
          <div class="tab" data-testid="nc-apis-tab">
            <GeneralIcon icon="code" class="tab-icon" :class="{}" />
            <div>APIs</div>
          </div>
        </template>
        <SmartsheetDetailsApi />
      </a-tab-pane>

      <a-tab-pane v-if="isUIAllowed('hookList')" key="webhook">
        <template #tab>
          <div class="tab" data-testid="nc-webhooks-tab">
            <GeneralIcon icon="webhook" class="tab-icon" :class="{}" />
            <div>Webhooks</div>
          </div>
        </template>
        <SmartsheetDetailsWebhooks />
      </a-tab-pane>
    </NcTabs>
  </div>
</template>

<style lang="scss" scoped>
.tab {
  @apply flex flex-row items-center gap-x-1.5 pr-0.5;
}

:deep(.ant-tabs-nav) {
  min-height: calc(var(--topbar-height) - 1.75px);
}
</style>
