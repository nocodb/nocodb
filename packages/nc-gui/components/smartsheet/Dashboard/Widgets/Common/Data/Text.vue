<script setup lang="ts">
import GroupedSettings from '../GroupedSettings.vue'

const emit = defineEmits<{
  'update:widget': [updates: any]
}>()

const { selectedWidget } = useWidgetStore()

const widgetData = reactive({
  title: selectedWidget?.title || '',
  description: selectedWidget?.description || '',
})

watch(widgetData, () => {
  emit('update:widget', widgetData)
})
</script>

<template>
  <GroupedSettings title="Text">
    <div class="flex flex-col gap-2 flex-1 min-w-0">
      <label>Title</label>
      <a-input v-model:value="widgetData.title" class="nc-input-sm nc-input-shadow" placeholder="Title" />
    </div>

    <div class="flex flex-col gap-2 flex-1 min-w-0">
      <label>Description</label>
      <a-textarea
        v-model:value="widgetData.description"
        class="nc-input-sm nc-input-text-area nc-input-shadow px-3 !text-gray-800 max-h-[150px] min-h-[100px]"
        placeholder="Description"
      />
    </div>
  </GroupedSettings>
</template>

<style scoped lang="scss"></style>
