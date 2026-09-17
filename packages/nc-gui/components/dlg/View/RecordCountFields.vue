<script setup lang="ts">
import type { ViewRecordCountSettings } from '~/utils/viewRecordCount'

const props = defineProps<{ modelValue: ViewRecordCountSettings; disabled?: boolean }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: ViewRecordCountSettings): void }>()

function update<K extends keyof ViewRecordCountSettings>(key: K, value: ViewRecordCountSettings[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

const maxInterval = computed(() => (props.modelValue.refreshUnit === 'hours' ? 24 * 365 : 365))

function updateUnit(unit: ViewRecordCountSettings['refreshUnit']) {
  emit('update:modelValue', {
    ...props.modelValue,
    refreshUnit: unit,
    refreshInterval: Math.min(props.modelValue.refreshInterval, unit === 'hours' ? 24 * 365 : 365),
  })
}
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="view-record-count-settings">
    <NcCheckbox :checked="modelValue.showCount" :disabled="disabled" @update:checked="update('showCount', $event)">
      {{ $t('labels.showViewRecordCount') }}
    </NcCheckbox>
    <NcCheckbox :checked="modelValue.boldWhenNonEmpty" :disabled="disabled" @update:checked="update('boldWhenNonEmpty', $event)">
      {{ $t('labels.boldViewWithRecords') }}
    </NcCheckbox>
    <div v-if="modelValue.showCount || modelValue.boldWhenNonEmpty" class="flex items-center gap-2">
      <label for="view-record-count-interval">{{ $t('labels.refreshViewRecordCountEvery') }}</label>
      <a-input-number
        id="view-record-count-interval"
        :value="modelValue.refreshInterval"
        :disabled="disabled"
        :min="1"
        :max="maxInterval"
        :precision="0"
        class="!w-20"
        @update:value="update('refreshInterval', typeof $event === 'number' ? Math.max(1, Math.min($event, maxInterval)) : 1)"
      />
      <a-select
        :value="modelValue.refreshUnit"
        :disabled="disabled"
        :aria-label="$t('labels.refreshIntervalUnit')"
        @update:value="updateUnit"
      >
        <a-select-option value="hours">{{ $t('labels.hours') }}</a-select-option>
        <a-select-option value="days">{{ $t('labels.days') }}</a-select-option>
      </a-select>
    </div>
  </div>
</template>
