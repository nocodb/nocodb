<script setup lang="ts">
import { TextWidgetTypes } from 'nocodb-sdk'
import GroupedSettings from '~/components/smartsheet/dashboard/widgets/common/GroupedSettings.vue'
import MarkdownRenderer from '~/components/smartsheet/dashboard/widgets/text/config/Markdown.vue'

const emit = defineEmits<{
  'update:content': [category: any]
}>()

const { selectedWidget } = storeToRefs(useWidgetStore())

const textContent = ref(selectedWidget.value?.config?.content || '')

const debouncedEmit = useDebounceFn(() => {
  emit('update:content', textContent.value)
}, 1000)

watch(textContent, () => {
  debouncedEmit()
})
</script>

<template>
  <GroupedSettings title="Content">
    <a-textarea
      v-if="selectedWidget?.config?.type === TextWidgetTypes.Text"
      ref="inputEl"
      v-model:value="textContent"
      class="nc-input-sm nc-input-text-area nc-input-shadow px-3 !text-gray-800"
      hide-details
      size="small"
    />

    <MarkdownRenderer
      v-else
      v-model:value="textContent"
      class="widget-content-input nc-input-shadow cursor-text p-1.5 border-1 rounded-lg"
    />
  </GroupedSettings>
</template>

<style lang="scss">
:deep(.widget-content-input) {
  @apply transition-all duration-150 min-h-8;
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
