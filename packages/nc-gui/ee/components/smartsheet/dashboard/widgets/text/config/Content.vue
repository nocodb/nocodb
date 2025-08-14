<script setup lang="ts">
import GroupedSettings from '~/components/smartsheet/dashboard/widgets/common/GroupedSettings.vue'

const emit = defineEmits<{
  'update:content': [category: any]
}>()

const { selectedWidget } = storeToRefs(useWidgetStore())

const textContent = ref(selectedWidget.value?.config?.content || '')

const throttledEmit = useThrottleFn(() => {
  emit('update:content', textContent.value)
}, 300)

const debouncedEmit = useDebounceFn(() => {
  emit('update:content', textContent.value)
}, 1000)

watch(textContent, () => {
  throttledEmit() // Immediate feedback while typing
  debouncedEmit() // Final update after user stops
})
</script>

<template>
  <GroupedSettings title="Content">
    <a-textarea
      ref="inputEl"
      v-model:value="textContent"
      class="nc-input-sm nc-input-text-area nc-input-shadow px-3 !text-gray-800"
      hide-details
      size="small"
    />
  </GroupedSettings>
</template>

<style scoped lang="scss">
:deep(.widget-content-input) {
  @apply transition-all duration-150 min-h-12;
  box-shadow: none;
  &:focus,
  &:focus-within {
    @apply min-h-16 !bg-white border-brand-500;
    box-shadow: 0px 0px 0px 2px rgba(51, 102, 255, 0.24);
  }
  &::placeholder {
    @apply !text-gray-400;
  }
}

:deep(.widget-content-input) {
  @apply bg-white;
}
</style>
