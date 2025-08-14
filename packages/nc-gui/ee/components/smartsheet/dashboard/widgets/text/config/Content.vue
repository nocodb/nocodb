<script setup lang="ts">
import { TextWidgetTypes } from 'nocodb-sdk'
import ExpandedTextEditor from './ExpandedTextEditor.vue'
import GroupedSettings from '~/components/smartsheet/dashboard/widgets/common/GroupedSettings.vue'

const emit = defineEmits<{
  'update:content': [category: any]
}>()

const { selectedWidget } = storeToRefs(useWidgetStore())

const textContent = ref(selectedWidget.value?.config?.content || '')
const showExpandedEditor = ref(false)

const isMarkdown = computed(() => selectedWidget.value?.config?.type === TextWidgetTypes.Markdown)

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

const handleExpandClick = () => {
  showExpandedEditor.value = true
}

const handleContentUpdate = (newContent: string) => {
  textContent.value = newContent
}

watch([() => selectedWidget.value?.config.content], () => {
  // If the update happens from the expanded editor, sync the value
  const elem = document.querySelector('.nc-text-widget-expanded')
  if (elem) {
    textContent.value = selectedWidget.value?.config.content
  }
})
</script>

<template>
  <GroupedSettings title="Content">
    <div class="relative">
      <a-textarea
        ref="inputEl"
        v-model:value="textContent"
        class="nc-input-sm nc-input-text-area widget-content-input nc-input-shadow px-3 !text-gray-800"
        hide-details
        size="small"
      />
      <NcButton
        type="text"
        size="small"
        class="!absolute bottom-2 right-2 !p-1 hover:bg-gray-100 rounded"
        @click="handleExpandClick"
      >
        <GeneralIcon icon="maximize" class="w-4 h-4 text-gray-500" />
      </NcButton>
    </div>

    <ExpandedTextEditor
      v-if="showExpandedEditor"
      v-model:value="showExpandedEditor"
      :content="textContent"
      :is-markdown="isMarkdown"
      :title="isMarkdown ? 'Markdown Editor' : 'Text Editor'"
      @update:content="handleContentUpdate"
    />
  </GroupedSettings>
</template>

<style scoped lang="scss">
:deep(.widget-content-input) {
  @apply transition-all duration-150 min-h-24;
  box-shadow: none;
  &:focus,
  &:focus-within {
    @apply min-h-26 !bg-white border-brand-500;
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
