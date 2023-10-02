<script setup lang="ts">
const { openedViewsTab } = storeToRefs(useViewsStore())
const { onViewsTabChange } = useViewsStore()

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const { $e } = useNuxtApp()

const { isUIAllowed } = useRoles()

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
    if (openedSubTab.value === 'field' && !isUIAllowed('hookList')) {
      onViewsTabChange('relation')
    }
    if (openedSubTab.value === 'webhook' && !isUIAllowed('hookList')) {
      onViewsTabChange('relation')
    }

    $e(`c:table:tab-open:${openedSubTab.value}`)
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <div
    class="flex flex-col h-full w-full"
    data-testid="nc-details-wrapper"
    :class="{
      'nc-details-tab-left-sidebar-close': !isLeftSidebarOpen,
    }"
  >
    <NcTabs v-model:activeKey="openedSubTab" centered class="nc-details-tab">
      <a-tab-pane v-if="isUIAllowed('fieldAdd')" key="field">
        <template #tab>
          <div class="tab" data-testid="nc-fields-tab">
            <GeneralIcon icon="list" class="tab-icon" :class="{}" />
            <div>Fields</div>
          </div>
        </template>
        <SmartsheetDetailsFields />
      </a-tab-pane>
      <a-tab-pane key="relation">
        <template #tab>
          <div class="tab" data-testid="nc-relations-tab">
            <GeneralIcon icon="erd" class="tab-icon" :class="{}" />
            <div>{{ $t('title.relations') }}</div>
          </div>
        </template>
        <SmartsheetDetailsErd />
      </a-tab-pane>

      <a-tab-pane key="api">
        <template #tab>
          <div class="tab" data-testid="nc-apis-tab">
            <GeneralIcon icon="code" class="tab-icon" :class="{}" />
            <div>{{ $t('labels.apis') }}</div>
          </div>
        </template>
        <SmartsheetDetailsApi />
      </a-tab-pane>

      <a-tab-pane v-if="isUIAllowed('hookList')" key="webhook">
        <template #tab>
          <div class="tab" data-testid="nc-webhooks-tab">
            <GeneralIcon icon="webhook" class="tab-icon" :class="{}" />
            <div>{{ $t('objects.webhooks') }}</div>
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

<style lang="scss">
.nc-details-tab.nc-tabs.centered {
  > .ant-tabs-nav {
    .ant-tabs-nav-wrap {
      @apply absolute mx-auto -left-9.5;
    }
  }
}

.nc-details-tab-left-sidebar-close > .nc-details-tab.nc-tabs.centered {
  > .ant-tabs-nav {
    .ant-tabs-nav-wrap {
      @apply absolute mx-auto left-0;
    }
  }
}
</style>
