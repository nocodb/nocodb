<script setup lang="ts">
import GroupedSettings from '~/components/smartsheet/dashboard/widgets/common/GroupedSettings.vue'

const emit = defineEmits<{
  'update:sandbox': any
}>()

const { selectedWidget } = storeToRefs(useWidgetStore())
const sandboxText = ref(selectedWidget.value?.config?.sandbox?.join?.(', ') || '')

const debouncedUrlUpdate = useDebounceFn(() => {
  emit('update:sandbox', {
    sandbox: sandboxText.value.split(',').map((s) => s.trim()),
  })
}, 500)

watch(sandboxText, () => {
  debouncedUrlUpdate()
})
</script>

<template>
  <GroupedSettings title="Security Settings">
    <div class="flex flex-col gap-3">
      <div class="flex flex-col gap-2">
        <label class="text-nc-content-gray-emphasis font-medium">Sandbox Permissions</label>
        <a-textarea v-model:value="sandboxText" class="nc-input-sm nc-input-text-area nc-input-shadow px-3 !text-gray-800" />
        <div class="text-nc-content-gray-muted text-xs">
          Common permissions: allow-scripts, allow-forms, allow-popups, allow-same-origin, allow-top-navigation, allow-downloads
        </div>
      </div>
    </div>
  </GroupedSettings>
</template>

<style scoped lang="scss"></style>
