<script setup lang="ts">
import { useWorkflowOrThrow } from '~/composables/useWorkflow'

const { hasManualTrigger, executeWorkflow: _executeWorkflow } = useWorkflowOrThrow()

const isLoading = ref(false)

const executeWorkflow = () => {
  isLoading.value = true
  _executeWorkflow()
  isLoading.value = false
}
</script>

<template>
  <div class="flex justify-between">
    <div class="flex gap-2 w-full">
      <!--      <NcButton type="secondary" size="small">
        <div class="flex items-center gap-2">
          <GeneralIcon icon="audit" />
          Automation Logs
        </div>
      </NcButton> -->

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
