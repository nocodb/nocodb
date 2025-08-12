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
      <a-input v-model:value="url" placeholder="https://example.com" class="w-full nc-input-sm nc-input-shadow" />
    </div>
  </GroupedSettings>
</template>

<style scoped lang="scss"></style>
