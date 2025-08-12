<script setup lang="ts">
import GroupedSettings from '~/components/smartsheet/dashboard/widgets/common/GroupedSettings.vue'

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
      ref="inputEl"
      v-model:value="textContent"
      class="nc-input-sm nc-input-text-area nc-input-shadow px-3 !text-gray-800"
      hide-details
      size="small"
    />
  </GroupedSettings>
</template>

<style scoped lang="scss"></style>
