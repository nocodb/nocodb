<script setup lang="ts">
import useTabs from '~/composables/useTabs'
import { TabMetaInj } from '~/context'

const { tabs, activeTabIndex, activeTab, closeTab } = useTabs()
const tableCreateDialog = ref(false)

provide(TabMetaInj, activeTab)
</script>

<template>
  <div class="nc-container d-flex flex-column">
    <div>
      <a-tabs v-model:activeKey="activeTabIndex" size="small" type="editable-card" @edit="closeTab">
        <a-tab-pane v-for="(tab, i) in tabs" :key="i" :tab="tab.title" />
      </a-tabs>
    </div>
    <div class="flex-1 min-h-0">
      <NuxtPage />
    </div>
  </div>
</template>

<style scoped>
.nc-container {
  height: calc(calc(100vh - var(--header-height)));
  @apply overflow-hidden;
}

:deep(.ant-tabs-nav) {
  @apply !mb-0;
}
</style>
