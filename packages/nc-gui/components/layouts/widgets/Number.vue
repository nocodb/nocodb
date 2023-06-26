<script lang="ts" setup>
import type { DataConfigNumber, NumberWidget } from 'nocodb-sdk'
import { Icon as IconifyIcon } from '@iconify/vue'
import { useWidget } from '~~/composables/useWidget'
const props = defineProps<{
  widgetConfig: NumberWidget
}>()

const { api } = useApi()

// Takes a number and formats it into a string that does:
// * it shortens the number by using 'k' for kilo, 'm' for milli etc
// * it does not round the number, but instead puts a decimal point in the right place
// * example: if the value ids 70000210, it will be formatted as '70.0m'
const formatValue = (value: number): string => {
  if (value === null || value === undefined) {
    return 'N/A'
  }
  if (value === 0) {
    return '0'
  }
  const absValue = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (absValue < 1000) {
    return `${sign}${absValue}`
  }
  const units = ['', 'k', 'm', 'b', 't']
  const unit = Math.floor(Math.log10(absValue) / 3)
  const num = absValue / 1000 ** unit
  const decimalPlaces = num < 10 ? 1 : 0
  return `${sign}${num.toFixed(decimalPlaces)}${units[unit]}`
}

const { widgetConfig } = toRefs(props)
const aggregatedNumberValue = ref<string>('NaN')
// const icon = ref<string>('default-icon')
const numberColumnTitle = ref<string | undefined>()
const aggregateFunction = ref<string>('Description')

const dashboardStore = useDashboardStore()
const { reloadWidgetDataEventBus } = dashboardStore
const { openedLayoutSidebarNode } = storeToRefs(dashboardStore)

const data_config = computed(() => widgetConfig.value?.data_config as DataConfigNumber)

const { dataLinkConfigIsMissing } = useWidget(widgetConfig)
const getData = async () => {
  if (!widgetConfig.value.id || dataLinkConfigIsMissing.value) {
    console.error('Tried to get data for Number Visualisation without complete data link configuration')
    return
  }
  const widgetData: any = await (await api.dashboard.widgetGet(openedLayoutSidebarNode.value!.id!, widgetConfig.value.id)).data
  numberColumnTitle.value = widgetData.columnName
  aggregateFunction.value = widgetData.aggregateFunction
  aggregatedNumberValue.value = formatValue(widgetData.value)
  // icon.value = widgetData.icon || 'default-icon'
}

reloadWidgetDataEventBus.on(async (ev) => {
  if (ev !== widgetConfig.value.id) {
    return
  }
  await getData()
})

onMounted(async () => {
  await getData()
})

watch(
  widgetConfig,
  async () => {
    if (!dataLinkConfigIsMissing.value) {
      await getData()
    }
  },
  {
    deep: true,
    immediate: true,
  },
)
</script>

<template>
  <div class="h-full">
    <div class="flex flex-col justify-between h-full">
      <!-- <a-statistic :title="columnTitleWithAggregateFnLabel" :value="aggregatedNumberValue" /> -->
      <div class="flex justify-between">
        <div class="flex flex-col">
          <h3 class="text-base font-medium text-gray-900 mb-1">{{ data_config.name }}</h3>
        </div>
        <!-- TODO make icon a dynamic value -->
        <IconifyIcon class="bg-blue-100 p-2 rounded h-10 min-w-10 text-lg" icon="iconoir:dollar"></IconifyIcon>
      </div>
      <div class="">
        <h2 v-if="dataLinkConfigIsMissing" class="text-5xl text-center mb-0">N/A</h2>
        <h1 v-else class="text-8xl text-center mb-0">{{ aggregatedNumberValue }}</h1>
      </div>
    </div>
  </div>
</template>

<style>
.ant-statistic-content-value {
  @apply text-8xl text-center;
}

.ant-statistic-content {
  @apply flex justify-center;
}

.ant-statistic-title {
  @apply text-base font-medium text-gray-900;
}
</style>
