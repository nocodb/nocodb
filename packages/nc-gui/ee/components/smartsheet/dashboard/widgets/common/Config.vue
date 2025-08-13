<script setup lang="ts">
import { ChartTypes, TextWidgetTypes, WidgetChartLabelMap, WidgetTypes } from 'nocodb-sdk'
import { chartIconMap, textIconMap } from '#imports'

defineProps<{
  disableAppearance?: boolean
}>()

const { selectedWidget } = storeToRefs(useWidgetStore())

const chartLabel = computed(() => {
  if (selectedWidget.value?.type === WidgetTypes.CHART) {
    return WidgetChartLabelMap[selectedWidget.value?.config?.chartType as ChartTypes]
  }
  return WidgetChartLabelMap[selectedWidget.value?.type as WidgetTypes]
})

const { updateWidget } = useWidgetStore()
const { activeDashboard } = storeToRefs(useDashboardStore())

const handleConfigUpdate = async (config: any) => {
  if (selectedWidget.value && activeDashboard.value?.id) {
    await updateWidget(activeDashboard.value.id, selectedWidget.value.id, {
      config: { ...selectedWidget.value.config, ...config },
    })
  }
}
</script>

<template>
  <div v-if="selectedWidget">
    <div class="flex h-14 items-center justify-between py-3 pl-4 pr-5 text-nc-content-gray">
      <div class="flex-1 text-nc-content-gray text-lg font-bold">
        {{ chartLabel }}
      </div>
      <NcButton size="small" type="text" @click="selectedWidget = null">
        <GeneralIcon icon="close" class="w-5 h-5 text-nc-content-gray" />
      </NcButton>
    </div>
    <div v-if="selectedWidget?.type === WidgetTypes.CHART" class="pl-4 pr-5">
      <NcSelect :value="selectedWidget?.config?.chartType" @change="handleConfigUpdate({ chartType: $event })">
        <a-select-option
          v-for="option of Object.values(ChartTypes).filter((type) => [ChartTypes.PIE, ChartTypes.DONUT].includes(type))"
          :key="option"
          :value="option"
        >
          <div class="flex items-center gap-2">
            <GeneralIcon :icon="chartIconMap[option]" class="w-5 h-5" />
            <span class="text-nc-content-gray text-sm">
              {{ WidgetChartLabelMap[option] }}
            </span>
          </div>
        </a-select-option>
      </NcSelect>
    </div>

    <div v-if="selectedWidget?.type === WidgetTypes.TEXT" class="pl-4 pr-5">
      <NcSelect :value="selectedWidget?.config?.type" @change="handleConfigUpdate({ type: $event })">
        <a-select-option v-for="option of Object.values(TextWidgetTypes)" :key="option" :value="option">
          <div class="flex items-center gap-2">
            <GeneralIcon :icon="textIconMap[option]" class="w-4 h-4" />
            <span class="text-nc-content-gray text-sm">
              {{ textLabelMap[option] }}
            </span>
          </div>
        </a-select-option>
      </NcSelect>
    </div>

    <NcTabs class="!mt-3">
      <a-tab-pane key="data" tab="Data">
        <template #tab>Data</template>
        <div :data-is-chart="selectedWidget?.type === WidgetTypes.CHART" class="overflow-auto editor-data-wrapper">
          <slot name="data"></slot>
        </div>
      </a-tab-pane>
      <a-tab-pane v-if="!disableAppearance" key="appearance" tab="Appearance">
        <template #tab>Appearance</template>
        <slot name="appearance"></slot>
      </a-tab-pane>
    </NcTabs>
  </div>
</template>

<style scoped lang="scss">
:deep(.ant-tabs-nav-wrap) {
  @apply !pl-3;
}

:deep(.ant-tabs-tab) {
  @apply !pb-0 pt-1;
}

:deep(.ant-tabs-nav) {
  @apply !mb-0 !pl-0 text-nc-content-gray-subtle2;
}

:deep(.ant-tabs-tab-btn) {
  @apply !mb-1;
}

.editor-data-wrapper {
  @apply h-[calc(100svh-195px)] overflow-auto;

  &[data-is-chart='true'] {
    @apply h-[calc(100svh-227px)];
  }
}
</style>
