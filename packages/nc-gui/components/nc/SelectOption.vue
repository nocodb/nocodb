<template>
  <a-select-option :value="value">
    <div class="flex items-center w-full justify-between w-full gap-2">
      <div class="truncate flex-1">
        <slot />
      </div>
      <component v-if="isSelected" id="nc-selected-item-icon" class="text-primary w-6 h-6" :is="iconMap.check" />
    </div>
  </a-select-option>
</template>
<script lang="ts" setup>
interface Props {
  isSelected?: boolean
  value?: string
}

const props = defineProps<Props>()
const isSelected = computed(() => props.isSelected)
const value = computed(() => props.value)
console.log(props.isSelected, isSelected)
</script>


