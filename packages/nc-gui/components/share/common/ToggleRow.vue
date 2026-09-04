<script lang="ts" setup>
import type { IconMapKey } from '~/utils/iconUtils'

interface Props {
  label: string
  modelValue: boolean
  icon?: IconMapKey
  description?: string
  disabled?: boolean
  loading?: boolean
  tooltip?: string
  testid?: string
  veKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  icon: undefined,
  description: undefined,
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
</script>

<template>
  <div class="px-3 py-2">
    <div class="flex items-center gap-3">
      <GeneralIcon v-if="icon" :icon="icon" class="flex-none !w-4 !h-4 text-nc-content-gray-subtle2" />
      <div class="flex flex-col flex-1 min-w-0">
        <div class="flex items-center gap-1 text-nc-content-gray-extreme text-bodyDefaultSm">
          <span>{{ label }}</span>
          <NcTooltip v-if="tooltip" class="flex items-center">
            <template #title>{{ tooltip }}</template>
            <GeneralIcon icon="info" class="flex-none !w-3.5 !h-3.5 text-nc-content-gray-subtle2 cursor-pointer" />
          </NcTooltip>
        </div>
        <div v-if="description" class="text-bodySm text-nc-content-gray-subtle">
          {{ description }}
        </div>
      </div>
      <NcSwitch
        v-model:checked="checked"
        v-e="veKey ? [veKey] : undefined"
        :loading="loading"
        :disabled="disabled"
        :data-testid="testid"
        size="small"
      />
    </div>
    <Transition mode="out-in" name="layout">
      <div v-if="checked && $slots.default" class="mt-2">
        <slot />
      </div>
    </Transition>
  </div>
</template>
