<script setup lang="ts">
import { useWorkflowOrThrow } from '~/composables/useWorkflow'

const { nodes, executeWorkflow: _executeWorkflow } = useWorkflowOrThrow()

const isLoading = ref(false)

const hasManualTrigger = computed(() => {
  return nodes.value.some((node) => node.type === 'core.trigger.manual')
})

const executeWorkflow = async () => {
  isLoading.value = true
  await _executeWorkflow()
  isLoading.value = false
}
</script>

<template>
  <div class="flex justify-between">
    <div class="flex gap-2 w-full">
      <NcTooltip placement="left" :disabled="hasManualTrigger">
        <NcButton
          :disabled="!hasManualTrigger || isLoading"
          :loading="isLoading"
          type="secondary"
          size="small"
          @click="executeWorkflow"
        >
          <div class="flex items-center gap-2">
            <GeneralIcon icon="ncSend" />
            {{ $t('labels.triggerWorkflow') }}
          </div>
        </NcButton>

        <template #title>
          {{ $t('tooltip.manualTriggerDisabled') }}
        </template>
      </NcTooltip>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
