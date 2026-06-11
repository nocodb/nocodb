<script setup lang="ts">
import GroupedSettings from '../GroupedSettings.vue'

const emit = defineEmits<{
  'update:widget': [updates: any]
}>()

const { selectedWidget } = useWidgetStore()

const widgetData = reactive({
  title: selectedWidget?.title ?? '',
  description: selectedWidget?.description ?? '',
})

const useDebouncedUpdateWidget = useDebounceFn(async () => {
  emit('update:widget', widgetData)
}, 500)

watch(widgetData, () => {
  useDebouncedUpdateWidget()
})
</script>

<template>
  <GroupedSettings :title="$t('general.text')">
    <div class="flex flex-col gap-2 flex-1 min-w-0">
      <label>{{ $t('general.title') }}</label>
      <a-input v-model:value="widgetData.title" class="nc-input-sm nc-input-shadow" :placeholder="$t('general.title')" />
    </div>

    <div class="flex flex-col gap-2 flex-1 min-w-0">
      <label>{{ $t('labels.description') }}</label>
      <a-textarea
        v-model:value="widgetData.description"
        class="nc-input-sm nc-input-text-area nc-input-shadow px-3 !text-nc-content-gray max-h-[150px] min-h-[100px]"
        :placeholder="$t('labels.description')"
      />
    </div>
  </GroupedSettings>
</template>
