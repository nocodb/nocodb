<script setup lang="ts">
import { charsetOptions } from 'nocodb-sdk'
import type { NSelectProps } from './types'

const props = withDefaults(defineProps<NSelectProps>(), {
  placeholder: '- select charset -',
  showSearch: false,
  suffixIcon: 'arrowDown',
  forceLoadBaseTables: false,
})

defineExpose({
  charsetOptions,
})
</script>

<template>
  <NSelect v-bind="props">
    <a-select-option v-for="charset of charsetOptions" :key="charset.label" :value="charset.value">
      <div class="w-full flex items-center gap-2">
        <NcTooltip class="flex-1 truncate" show-on-truncate-only>
          <template #title>{{ charset.label }}</template>
          <span>{{ charset.label }}</span>
        </NcTooltip>
        <component
          :is="iconMap.check"
          v-if="modelValue === charset.value"
          id="nc-selected-item-icon"
          class="flex-none text-primary w-4 h-4"
        />
      </div>
    </a-select-option>
  </NSelect>
</template>
