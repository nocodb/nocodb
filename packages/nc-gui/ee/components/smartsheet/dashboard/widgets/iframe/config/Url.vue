<script setup lang="ts">
import GroupedSettings from '~/components/smartsheet/dashboard/widgets/common/GroupedSettings.vue'

const emit = defineEmits<{
  'update:url': any
}>()

const { selectedWidget } = storeToRefs(useWidgetStore())

const url = ref(selectedWidget.value?.config?.url || '')

const debouncedUrlUpdate = useDebounceFn(() => {
  emit('update:url', {
    url: url.value,
  })
}, 500)

watch(url, () => {
  debouncedUrlUpdate()
})
</script>

<template>
  <GroupedSettings title="Config">
    <div class="flex flex-col gap-2">
      <label class="text-nc-content-gray-emphasis font-medium">URL</label>
      <label class="text-nc-content-gray-subtle2 text-bodySm">
        Important: Only embed URLs from sources you control or completely trust.
      </label>

      <a-textarea
        ref="inputEl"
        v-model:value="url"
        class="nc-input-sm nc-input-text-area widget-content-input nc-input-shadow px-3 !text-gray-800"
        placeholder="https://example.com"
        size="small"
      />
    </div>
  </GroupedSettings>
</template>

<style scoped lang="scss"></style>
