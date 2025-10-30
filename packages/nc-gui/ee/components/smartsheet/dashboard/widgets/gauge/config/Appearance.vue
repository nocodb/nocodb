<script setup lang="ts">
import type { GaugeRange } from 'nocodb-sdk'
import GroupedSettings from '../../common/GroupedSettings.vue'

const emit = defineEmits<{
  'update:appearance': [source: any]
}>()

const { selectedWidget } = storeToRefs(useWidgetStore())

const showValue = ref(selectedWidget.value?.config?.appearance?.showValue ?? true)

const ranges = ref<GaugeRange[]>(
  selectedWidget.value?.config?.appearance?.ranges || [
    { color: '#FF6E76', min: 0, max: 33, label: 'Low' },
    { color: '#FDDD60', min: 33, max: 66, label: 'Medium' },
    { color: '#7CFFB2', min: 66, max: 100, label: 'High' },
  ],
)

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

  ranges.value[index][field] = value as never
  onRangesUpdate()
}
</script>

<template>
  <GroupedSettings title="Gauge ranges">
    <div class="flex flex-col gap-3">
      <div v-for="(range, index) in ranges" :key="index" class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <input
            :value="range.color"
            type="color"
            class="w-10 h-10 rounded cursor-pointer border border-nc-border-gray"
            @input="updateRange(index, 'color', ($event.target as HTMLInputElement).value)"
          />
          <NcNonNullableNumberInput
            :model-value="range.min"
            :min="ranges[index - 1]?.max ?? 0"
            :max="range.max - 1"
            class="flex-1"
            placeholder="Min"
            @update:model-value="updateRange(index, 'min', $event)"
          />
          <NcNonNullableNumberInput
            :model-value="range.max"
            :min="range.min + 1"
            :max="ranges[index + 1]?.min ?? Infinity"
            class="flex-1"
            placeholder="Max"
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
</style>
