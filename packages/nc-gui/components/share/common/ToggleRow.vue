<script lang="ts" setup>
import type { IconMapKey } from '~/utils/iconUtils'

interface Props {
  label: string
  modelValue: boolean
  icon?: IconMapKey
  description?: string
  /** Optional override for the description when the toggle is on. Defaults to `description`. */
  onDescription?: string
  disabled?: boolean
  loading?: boolean
  tooltip?: string
  testid?: string
  veKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  icon: undefined,
  description: undefined,
  onDescription: undefined,
  disabled: false,
  loading: false,
  tooltip: undefined,
  testid: undefined,
  veKey: undefined,
})

const emits = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const checked = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emits('update:modelValue', value),
})

const activeDescription = computed(() => {
  if (props.modelValue && props.onDescription) return props.onDescription
  return props.description
})

const onRowClick = (event: MouseEvent) => {
  if (props.disabled || props.loading) return

  // Skip when the click already landed on something interactive inside the row
  // (the switch itself, an inner button/input, the expanded slot, etc.). The
  // toggle should only flip when the user clicks the surrounding label area.
  const target = event.target as HTMLElement | null
  if (
    target?.closest(
      'button, input, textarea, select, a, .ant-switch, .ant-select, .ant-input, .ant-radio-wrapper, .ant-input-password',
    )
  ) {
    return
  }

  checked.value = !checked.value
}
</script>

<template>
  <div
    class="px-3 py-2 transition-colors"
    :class="{
      'cursor-pointer hover:bg-nc-bg-gray-extralight': !disabled && !loading,
      'opacity-60': disabled,
    }"
    @click="onRowClick"
  >
    <div class="flex items-start gap-3">
      <GeneralIcon v-if="icon" :icon="icon" class="flex-none !w-4 !h-4 mt-0.5 text-nc-content-gray-subtle2" />
      <div class="flex flex-col flex-1 min-w-0">
        <div class="flex items-center gap-2 text-nc-content-gray-extreme text-bodyDefaultSm font-weight-600">
          <span>{{ label }}</span>
          <slot name="statusChip" />
          <NcTooltip v-if="tooltip" class="flex items-center">
            <template #title>{{ tooltip }}</template>
            <GeneralIcon icon="info" class="flex-none !w-3.5 !h-3.5 text-nc-content-gray-subtle2 cursor-pointer" />
          </NcTooltip>
        </div>
        <div v-if="activeDescription" class="text-bodySm text-nc-content-gray-subtle leading-snug mt-0.5">
          {{ activeDescription }}
        </div>
      </div>
      <NcSwitch
        v-model:checked="checked"
        v-e="veKey ? [veKey] : undefined"
        :loading="loading"
        :disabled="disabled"
        :data-testid="testid"
        size="small"
        class="mt-0.5"
      />
    </div>
    <div v-if="checked && $slots.default" class="mt-2">
      <slot />
    </div>
  </div>
</template>
