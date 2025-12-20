<script setup lang="ts">
import { useWorkflowOrThrow } from '~/composables/useWorkflow'

const workflowStore = useWorkflowStore()

const { executeWorkflow: _executeWorkflow } = workflowStore

const { nodes, workflow } = useWorkflowOrThrow()

const isLoading = ref(false)

const executeWorkflow = async () => {
  if (!workflow.value?.id) return
  isLoading.value = true
  await _executeWorkflow(workflow.value?.id)
  isLoading.value = false
}

const hasManualTrigger = computed(() => {
  return nodes.value.some((node) => node.type === 'core.trigger.manual')
})
</script>

<template>
  <div v-if="hasManualTrigger" class="absolute w-[calc(100%-379px)] bottom-2 flex items-center right-0 left-0">
    <NcButton class="mx-auto" :disabled="isLoading" :loading="isLoading" size="small" @click="executeWorkflow">
      <div class="flex items-center gap-2">
        <GeneralIcon icon="ncSend" />
        {{ $t('labels.triggerWorkflow') }}
      </div>
    </NcButton>
  </div>
  <NcSpanHidden v-else />
</template>

<style scoped lang="scss"></style>
