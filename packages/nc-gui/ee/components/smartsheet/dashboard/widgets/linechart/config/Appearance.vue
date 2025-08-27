<script setup lang="ts">
import GroupedSettings from '../../common/GroupedSettings.vue'

const emit = defineEmits<{
  'update:appearance': [source: any]
  'update:size': [size: any]
}>()

const { selectedWidget } = storeToRefs(useWidgetStore())

const legendPosition = [
  { label: 'Top', value: 'top' },
  { label: 'Right', value: 'right' },
  { label: 'Bottom', value: 'bottom' },
  { label: 'Left', value: 'left' },
]

const sizeMap = {
  small: {
    h: 5,
    w: 2,
  },
  medium: {
    h: 6,
    w: 2,
  },
}

const size = computed(() => (selectedWidget.value?.position?.h === 5 ? 'small' : 'medium'))

const appearanceLegendPosition = ref(selectedWidget.value?.config?.appearance?.legendPosition || 'right')

const showCountInLegend = ref(selectedWidget.value?.config?.appearance?.showCountInLegend || true)

const showPercentageOnChart = ref(selectedWidget.value?.config?.appearance?.showPercentageOnChart || true)

const plotDataPoints = ref(selectedWidget.value?.config?.appearance?.plotDataPoints || true)

const smoothLines = ref(selectedWidget.value?.config?.appearance?.smoothLines || true)

const fieldsYAxis = computed(() => selectedWidget.value?.config?.data?.yAxis?.fields || [])

const handleChange = (type?: string, value?: any) => {
  if (type === 'size') {
    emit('update:size', {
      h: sizeMap[value].h,
      w: sizeMap[value].w,
    })
    return
  }

  emit('update:appearance', {
    legendPosition: appearanceLegendPosition.value,
    showCountInLegend: showCountInLegend.value,
    showPercentageOnChart: showPercentageOnChart.value,
    plotDataPoints: plotDataPoints.value,
    smoothLines: smoothLines.value,
  })
}
</script>

<template>
  <GroupedSettings title="Style">
    <div class="flex gap-2 flex-1 min-w-0">
      <div class="flex flex-col gap-2 flex-1 min-w-0">
        <label>Appearance</label>
        <a-select
          v-model:value="size"
          class="nc-select-shadow"
          placeholder="Legent Orientation"
          @update:value="handleChange('size', $event)"
        >
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-gray-700" />
          </template>

          <a-select-option value="small">Small</a-select-option>
          <a-select-option value="medium">Medium</a-select-option>
        </a-select>
      </div>

      <div v-if="fieldsYAxis.length > 1" class="flex flex-col gap-2 flex-1 min-w-0">
        <label>Legend Orientation</label>
        <a-select
          v-model:value="appearanceLegendPosition"
          :options="legendPosition"
          class="nc-select-shadow"
          placeholder="Legent Orientation"
          @update:value="handleChange()"
        >
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-gray-700" />
          </template>
        </a-select>
      </div>
    </div>

    <div class="space-y-1">
      <div>
        <NcSwitch v-model:checked="showPercentageOnChart" @change="handleChange">
          <span class="text-caption text-nc-content-gray select-none">Show percentage in chart</span>
        </NcSwitch>
      </div>
      <div>
        <NcSwitch v-model:checked="showCountInLegend" @change="handleChange">
          <span class="text-caption text-nc-content-gray select-none">Show count in legend</span>
        </NcSwitch>
      </div>
      <div>
        <NcSwitch v-model:checked="plotDataPoints" @change="handleChange">
          <span class="text-caption text-nc-content-gray select-none">Plot data points</span>
        </NcSwitch>
      </div>
      <div>
        <NcSwitch v-model:checked="smoothLines" @change="handleChange">
          <span class="text-caption text-nc-content-gray select-none">Smooth lines</span>
        </NcSwitch>
      </div>
    </div>
  </GroupedSettings>
</template>

<style scoped lang="scss">
.appearance-type {
  :deep(.ant-radio-input:focus + .ant-radio-inner) {
    box-shadow: none !important;
  }
  :deep(.ant-radio-wrapper) {
    > span {
      @apply text-nc-content-gray leading-5;
    }
    @apply flex py-2 m-0;
    .ant-radio-checked .ant-radio-inner {
      @apply !bg-nc-fill-primary !border-nc-fill-primary;
      &::after {
        @apply bg-nc-bg-default;
        width: 12px;
        height: 12px;
        margin-top: -6px;
        margin-left: -6px;
      }
    }
    &:first-child {
      @apply rounded-tl-lg rounded-tr-lg;
    }
    &:last-child {
      @apply border-t-0 rounded-bl-lg rounded-br-lg;
    }
  }
}
</style>
