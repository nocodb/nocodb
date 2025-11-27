<script setup lang="ts">
import { useWorkflowOrThrow } from '~/composables/useWorkflow'

const { hasManualTrigger, executeWorkflow: _executeWorkflow } = useWorkflowOrThrow()

const isLoading = ref(false)
const showExecutionLogs = ref(false)

const executeWorkflow = async () => {
  isLoading.value = true
  await _executeWorkflow()
  isLoading.value = false
}

const openExecutionLogs = () => {
  showExecutionLogs.value = true
}
</script>

<template>
  <div class="flex justify-between">
    <div class="flex gap-2 w-full">
      <NcButton type="secondary" size="small" @click="openExecutionLogs">
        <div class="flex items-center gap-2">
          <GeneralIcon icon="audit" />
          Workflow Logs
        </div>
      </NcButton>

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

    <DlgWorkflowExecutionLogs v-model="showExecutionLogs" />
  </div>
</template>

<style scoped lang="scss"></style>
