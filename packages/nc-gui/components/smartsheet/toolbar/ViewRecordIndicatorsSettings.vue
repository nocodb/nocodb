<script setup lang="ts">
import type { ViewRecordIndicatorSettings } from '~/lib/viewRecordIndicators'
import { isValidViewRecordIndicatorSettings } from '~/lib/viewRecordIndicators'

const props = defineProps<{
  modelValue: ViewRecordIndicatorSettings
  disabled?: boolean
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: ViewRecordIndicatorSettings): void
}>()

const intervalValid = computed(() => isValidViewRecordIndicatorSettings(props.modelValue))

function update(changes: Partial<ViewRecordIndicatorSettings>) {
  if (props.disabled) return
  emit('update:modelValue', { ...props.modelValue, ...changes })
}

function updateAmount(value: string | number | null) {
  update({ refreshAmount: value === null || value === '' ? 0 : Number(value) })
}

function updateUnit(value: unknown) {
  if (value === 'hours' || value === 'days') update({ refreshUnit: value })
}
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="view-record-indicator-settings">
    <NcCheckbox
      :checked="modelValue.showCount"
      :disabled="disabled"
      data-testid="view-indicators-show-count"
      @update:checked="update({ showCount: $event })"
    >
      {{ $t('labels.viewRecordIndicators.showCount') }}
    </NcCheckbox>
    <NcCheckbox
      :checked="modelValue.boldNonEmpty"
      :disabled="disabled"
      data-testid="view-indicators-bold-nonempty"
      @update:checked="update({ boldNonEmpty: $event })"
    >
      {{ $t('labels.viewRecordIndicators.boldNonEmpty') }}
    </NcCheckbox>
    <div class="flex flex-col gap-1.5">
      <label class="text-[13px] text-nc-content-gray">
        {{ $t('labels.viewRecordIndicators.refreshEvery') }}
      </label>
      <div class="flex gap-2">
        <a-input-number
          :value="modelValue.refreshAmount"
          :min="1"
          :precision="0"
          :disabled="disabled"
          :aria-label="$t('labels.viewRecordIndicators.refreshEvery')"
          class="!w-24"
          data-testid="view-indicators-refresh-amount"
          @update:value="updateAmount"
        />
        <NcSelect
          :value="modelValue.refreshUnit"
          :disabled="disabled"
          :aria-label="$t('labels.viewRecordIndicators.refreshUnit')"
          class="w-28"
          data-testid="view-indicators-refresh-unit"
          @update:value="updateUnit"
        >
          <a-select-option value="hours">{{ $t('labels.viewRecordIndicators.hours') }}</a-select-option>
          <a-select-option value="days">{{ $t('labels.viewRecordIndicators.days') }}</a-select-option>
        </NcSelect>
      </div>
      <p v-if="!intervalValid" class="m-0 text-nc-content-red-medium text-xs" role="alert">
        {{ $t('labels.viewRecordIndicators.invalidInterval') }}
      </p>
      <p class="m-0 text-nc-content-gray-subtle2 text-xs">
        {{ $t('labels.viewRecordIndicators.description') }}
      </p>
    </div>
  </div>
</template>
