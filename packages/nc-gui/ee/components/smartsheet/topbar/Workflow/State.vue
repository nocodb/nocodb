<script setup lang="ts">
const workflowStore = useWorkflowStore()

const { updateWorkflow } = workflowStore

const { activeWorkflow } = storeToRefs(workflowStore)

const toggleWorkflow = async () => {
  if (!activeWorkflow.value || !activeWorkflow.value.base_id || !activeWorkflow.value.id) {
    return
  }
  await updateWorkflow(activeWorkflow.value.base_id, activeWorkflow.value?.id, {
    ...activeWorkflow.value,
    enabled: !activeWorkflow.value.enabled,
  })
}
</script>

<template>
  <NcTooltip overlay-class-name="uppercase" placement="right">
    <div
      :class="{
        'bg-nc-bg-brand text-captionBold text-nc-content-brand': activeWorkflow?.enabled,
        'bg-nc-bg-gray-medium  text-caption text-nc-content-gray-muted': !activeWorkflow?.enabled,
      }"
      class="ml-2 uppercase cursor-pointer rounded-lg px-2 py-1"
      @click="toggleWorkflow"
    >
      {{ activeWorkflow?.enabled ? $t('general.on') : $t('general.off') }}
    </div>

    <template #title>
      {{ activeWorkflow?.enabled ? $t('general.on') : $t('general.off') }}
    </template>
  </NcTooltip>
</template>

<style scoped lang="scss"></style>
