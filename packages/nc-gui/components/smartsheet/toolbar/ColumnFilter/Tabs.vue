<script setup lang="ts">
interface FilterTab {
  key: string
  label: string
  count?: number
  tooltip?: string
}

interface Props {
  activeKey: string
  tabs: FilterTab[]
}

const props = defineProps<Props>()

const emits = defineEmits(['update:activeKey'])

const activeKey = useVModel(props, 'activeKey', emits)
</script>

<template>
  <NcTabs v-model:activeKey="activeKey" class="nc-filter-tabs">
    <a-tab-pane v-for="tab in tabs" :key="tab.key">
      <template #tab>
        <div class="flex items-center gap-1">
          {{ tab.label }}
          <span
            v-if="tab.count"
            class="nc-filter-tab-count"
            :class="activeKey === tab.key ? 'nc-filter-tab-count-active' : 'nc-filter-tab-count-inactive'"
          >
            {{ tab.count }}
          </span>
          <NcTooltip v-if="tab.tooltip" :title="tab.tooltip" placement="top" class="flex">
            <GeneralIcon icon="ncInfo" class="nc-filter-tab-info-icon !w-3.5 !h-3.5" />
          </NcTooltip>
        </div>
      </template>
    </a-tab-pane>
  </NcTabs>
</template>

<style lang="scss" scoped>
.nc-filter-tabs {
  :deep(.ant-tabs-nav) {
    @apply !px-2 !mb-0;
  }
}

.nc-filter-tab-count {
  @apply text-tiny min-w-4 h-5 px-1 rounded-md inline-flex items-center justify-center;
}

.nc-filter-tab-count-active {
  @apply bg-nc-bg-brand text-nc-content-brand;
}

.nc-filter-tab-count-inactive {
  @apply bg-nc-bg-gray-medium text-nc-content-gray-muted;
}

.nc-filter-tab-info-icon {
  color: var(--nc-content-gray-muted);
}
</style>
