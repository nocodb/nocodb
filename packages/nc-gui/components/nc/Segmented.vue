<script lang="ts" setup>
/**
 * @description
 * A short choice of exclusive options, shown together (radio semantics).
 *
 * @example
 * <NcSegmented v-model:value="mode" :options="[{ value: 'draft', label: 'Draft' }, { value: 'ready', label: 'Ready' }]" />
 */
interface Option {
  value: string
  label: string
  disabled?: boolean
  tooltip?: string
}

interface Props {
  options: Option[]
  /** Nothing checked when it matches no option, e.g. a mixed state. */
  value?: string
  disabled?: boolean
  ariaLabel?: string
}

const props = defineProps<Props>()

const emits = defineEmits<{
  'update:value': [value: string]
}>()

function pick(option: Option) {
  if (props.disabled || option.disabled || option.value === props.value) return
  emits('update:value', option.value)
}
</script>

<template>
  <div role="radiogroup" :aria-label="ariaLabel" class="nc-segmented" :class="{ 'is-disabled': disabled }">
    <NcTooltip v-for="option of options" :key="option.value" :disabled="!option.tooltip" :arrow="false">
      <template #title>{{ option.tooltip }}</template>
      <button
        type="button"
        role="radio"
        class="nc-segmented-option"
        :class="{ 'is-on': option.value === value }"
        :aria-checked="option.value === value"
        :disabled="disabled || option.disabled"
        :data-testid="`nc-segmented-${option.value}`"
        @click="pick(option)"
      >
        {{ option.label }}
      </button>
    </NcTooltip>
  </div>
</template>

<style lang="scss" scoped>
.nc-segmented {
  @apply inline-flex flex-none gap-0.5 p-0.75 rounded-lg bg-nc-bg-gray-light;
}

.nc-segmented-option {
  @apply h-6.5 px-2.5 border-0 rounded-md bg-transparent text-nc-content-gray-subtle font-semibold whitespace-nowrap cursor-pointer outline-none;

  font-size: 12.5px;
  transition: background-color 0.15s, color 0.15s;

  &:hover:not(:disabled):not(.is-on) {
    @apply text-nc-content-gray;
  }

  &:focus-visible {
    @apply shadow-focus;
  }

  &:disabled {
    @apply cursor-not-allowed opacity-50;
  }

  &.is-on {
    @apply bg-nc-bg-default text-nc-content-brand;

    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }
}
</style>
