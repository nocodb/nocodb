<script lang="ts" setup>
import type { LocalSelectOptionType } from './utils'
import type { CellStepperOption } from '~/components/cell/LayoutStepper.vue'

interface Props {
  options: LocalSelectOptionType[]
  modelValue?: string
  format?: 'radio' | 'number'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  format: 'radio',
  disabled: false,
})

const emits = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const stepperOptions = computed<CellStepperOption[]>(() =>
  props.options.map((op) => ({ key: op.title ?? '', title: op.title ?? '' })),
)

const optionsByKey = computed(() => new Map(props.options.map((op) => [op.title ?? '', op])))
</script>

<template>
  <CellLayoutStepper
    :options="stepperOptions"
    :model-value="modelValue"
    :format="format"
    :disabled="disabled"
    @update:model-value="(value) => emits('update:modelValue', value)"
  >
    <!-- Option color only on the selected chip (and in the All-options menu);
         unselected chips stay plain outlines — Airtable stepper parity. -->
    <template #chip="{ option, selected, inMenu }">
      <a-tag
        class="nc-stepper-select-chip rounded-tag max-w-full !m-0"
        :class="{ 'nc-stepper-select-chip-plain': !(selected || inMenu) }"
        :color="selected || inMenu ? optionsByKey.get(option.key)?.bgColor : undefined"
      >
        <span class="text-small" :style="{ color: selected || inMenu ? optionsByKey.get(option.key)?.textColor : undefined }">
          <NcTooltip class="truncate max-w-full" show-on-truncate-only>
            <template #title>
              {{ option.title }}
            </template>
            <span
              class="text-ellipsis overflow-hidden"
              :style="{
                wordBreak: 'keep-all',
                whiteSpace: 'nowrap',
                display: 'inline',
              }"
            >
              {{ option.title }}
            </span>
          </NcTooltip>
        </span>
      </a-tag>
    </template>
  </CellLayoutStepper>
</template>

<style lang="scss" scoped>
.rounded-tag {
  @apply py-[0.5px] px-2 rounded-[12px];
}

.nc-stepper-select-chip-plain {
  border: 1px solid var(--nc-border-gray-medium) !important;
  background: var(--nc-bg-default) !important;
  color: var(--nc-content-gray) !important;
}
</style>
