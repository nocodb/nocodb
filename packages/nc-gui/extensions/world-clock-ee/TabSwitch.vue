<script lang="ts" setup>
import type { SelectOption } from './types'

const props = defineProps<{
  modelValue: string
  options: SelectOption[]
}>()

const selectedValue = useVModel(props, 'modelValue')
</script>

<template>
  <div class="flex flex-row p-1 bg-gray-200 rounded-lg gap-x-0.5 nc-view-sidebar-tab justify-between h-8">
    <div
      v-for="option in options"
      :key="option.value"
      class="tab"
      :class="{
        active: selectedValue === option.value,
      }"
      @click="selectedValue = option.value"
    >
      <GeneralIcon v-if="option.icon" class="tab-icon" :icon="option.icon" ignore-color />
      <div class="tab-title nc-tab">{{ option.title ?? option.value }}</div>
    </div>
  </div>
</template>

<style scoped>
.tab {
  @apply flex flex-row items-center w-full justify-center px-2 py-1 rounded-md gap-x-2 text-gray-600 hover:text-black cursor-pointer transition-all duration-300 select-none;
}

.tab-icon {
  font-size: 1rem !important;
  @apply w-4;
}
.tab .tab-title {
  @apply min-w-0;
  word-break: keep-all;
  white-space: nowrap;
  display: inline;
  line-height: 0.95;
}

.active {
  @apply bg-white text-brand-600 hover:text-brand-600;

  box-shadow: 0 3px 1px -2px rgba(0, 0, 0, 0.06), 0 5px 3px -2px rgba(0, 0, 0, 0.02);
}
</style>
