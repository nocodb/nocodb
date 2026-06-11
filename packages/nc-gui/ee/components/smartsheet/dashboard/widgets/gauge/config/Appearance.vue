<script setup lang="ts">
import type { GaugeRange } from 'nocodb-sdk'
import { defaultGaugeWidgetRange } from 'nocodb-sdk'
import GroupedSettings from '../../common/GroupedSettings.vue'

const emit = defineEmits<{
  'update:appearance': [source: any]
}>()

const { selectedWidget } = storeToRefs(useWidgetStore())

const showValue = ref(selectedWidget.value?.config?.appearance?.showValue ?? true)

const ranges = ref<GaugeRange[]>(selectedWidget.value?.config?.appearance?.ranges || defaultGaugeWidgetRange)

// Tracks which range row's color picker is currently open. Only one open at a time.
const openColorIndex = ref<number | null>(null)

const onShowValueChange = () => {
  emit('update:appearance', {
    showValue: showValue.value,
    ranges: ranges.value,
  })
}

const onRangesUpdate = () => {
  emit('update:appearance', {
    showValue: showValue.value,
    ranges: ranges.value,
  })
}

const addRange = () => {
  const lastRange = ranges.value[ranges.value.length - 1]
  const newMin = lastRange ? lastRange.max : 0
  const newMax = newMin + 10

  ranges.value.push({
    color: '#58D9F9',
    min: newMin,
    max: newMax,
    label: '',
  })
  onRangesUpdate()
}

const removeRange = (index: number) => {
  ranges.value.splice(index, 1)
  onRangesUpdate()
}

const updateRange = (index: number, field: keyof GaugeRange, value: any) => {
  const range = ranges.value[index]
  if (!range) return

  if (field === 'min' || field === 'max') {
    const numValue = Number(value)
    ranges.value[index][field] = numValue as never

    // Auto-adjust adjacent ranges to maintain continuity
    if (field === 'max' && index < ranges.value.length - 1) {
      ranges.value[index + 1].min = numValue
    }
    if (field === 'min' && index > 0) {
      ranges.value[index - 1].max = numValue
    }
  } else {
    ranges.value[index][field] = value as never
  }

  onRangesUpdate()
}
</script>

<template>
  <GroupedSettings title="Gauge ranges">
    <div class="flex flex-col gap-3">
      <div v-for="(range, index) in ranges" :key="index" class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <NcDropdown
            :visible="openColorIndex === index"
            :auto-close="false"
            overlay-class-name="nc-gauge-color-overlay"
            @update:visible="(v) => (openColorIndex = v ? index : null)"
          >
            <button
              type="button"
              class="nc-gauge-color-swatch"
              :style="{ backgroundColor: range.color }"
              @click="openColorIndex = openColorIndex === index ? null : index"
            />
            <template #overlay>
              <div class="nc-gauge-color-panel">
                <LazyGeneralChromeWrapper
                  :model-value="range.color"
                  class="!w-full !shadow-none !bg-transparent"
                  @input="updateRange(index, 'color', $event)"
                />
              </div>
            </template>
          </NcDropdown>
          <NcNonNullableNumberInput
            :model-value="range.min"
            :min="0"
            :max="range.max - 1"
            class="flex-1"
            :placeholder="$t('general.min')"
            :disabled="index > 0"
            @update:model-value="updateRange(index, 'min', $event)"
          />
          <NcNonNullableNumberInput
            :model-value="range.max"
            :min="range.min + 1"
            class="flex-1"
            :placeholder="$t('general.max')"
            :disabled="index < ranges.length - 1"
            @update:model-value="updateRange(index, 'max', $event)"
          />
          <NcButton v-if="ranges.length > 1" size="small" type="text" @click="removeRange(index)">
            <GeneralIcon icon="delete" />
          </NcButton>
        </div>
        <a-input
          :value="range.label"
          class="nc-input-shadow !rounded-lg"
          placeholder="Label (optional)"
          @update:value="updateRange(index, 'label', $event)"
        />
      </div>
      <NcButton size="small" type="secondary" class="!w-full" @click="addRange">
        <div class="flex items-center gap-2">
          <GeneralIcon icon="plus" />
          Add a range
        </div>
      </NcButton>
    </div>
  </GroupedSettings>

  <GroupedSettings title="Display Options">
    <div class="flex flex-col gap-3">
      <div>
        <NcSwitch v-model:checked="showValue" @change="onShowValueChange">
          <span class="text-caption text-nc-content-gray select-none">Show value in gauge</span>
        </NcSwitch>
      </div>
    </div>
  </GroupedSettings>
</template>

<style scoped lang="scss">
:deep(.ant-input-number-handler-wrap) {
  @apply hidden;
}

.nc-gauge-color-swatch {
  @apply w-8 h-8 rounded-lg cursor-pointer border border-nc-border-gray-medium
         shadow-default flex items-center justify-center flex-shrink-0
         transition-all duration-150;

  &:hover {
    @apply shadow-hover;
  }
}
</style>

<style lang="scss">
.nc-gauge-color-overlay {
  @apply bg-nc-bg-default overflow-hidden w-[280px];
}
</style>
