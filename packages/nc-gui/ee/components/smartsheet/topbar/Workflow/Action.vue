<script setup lang="ts">
import type { WorkflowGeneralNode } from 'nocodb-sdk'
import { GeneralNodeID, NcErrorType } from 'nocodb-sdk'

const workflowStore = useWorkflowStore()

const { activeWorkflowHasDraftChanges, activeWorkflow } = storeToRefs(workflowStore)

const { updateWorkflow, publishWorkflow } = useWorkflowStore()

const isPublishing = ref(false)
const showPendingExecutionsModal = ref(false)
const pendingExecutionsCount = ref(0)

const revertToPublished = async () => {
  if (!activeWorkflow.value?.id || !activeWorkflow.value?.base_id) return
  await updateWorkflow(
    activeWorkflow.value?.base_id,
    activeWorkflow.value?.id,
    {
      draft: null,
    },
    {
      bumpDirty: true,
    },
  )
}

const canPublish = computed(() => {
  if (!activeWorkflowHasDraftChanges.value) return false

  const draftNodes = (activeWorkflow.value?.draft?.nodes || []) as Array<WorkflowGeneralNode>

  for (const node of draftNodes) {
    if ([GeneralNodeID.TRIGGER, GeneralNodeID.PLUS, GeneralNodeID.NOTE].includes(node.type as any)) {
      continue
    }

    const testResult = node.data?.testResult

    if (!testResult || testResult?.status !== 'success' || testResult?.isStale === true) {
      return false
    }
  }

  return true
})

const handlePublish = async (cancelPendingExecutions?: boolean) => {
  if (!canPublish.value || !activeWorkflow.value?.id) return

  isPublishing.value = true
  try {
    await publishWorkflow(activeWorkflow.value?.id, { cancelPendingExecutions })
    showPendingExecutionsModal.value = false
  } catch (e: any) {
    const errorData = e?.response?.data
    // Check if error is ERR_WORKFLOW_WAITING_EXECUTIONS
    if (errorData?.error === NcErrorType.ERR_WORKFLOW_WAITING_EXECUTIONS) {
      pendingExecutionsCount.value = errorData?.details?.count || 0
      showPendingExecutionsModal.value = true
    } else if (errorData?.error === NcErrorType.ERR_PLAN_LIMIT_EXCEEDED) {
      message.error(errorData?.message)
    } else {
      message.error(await extractSdkResponseErrorMsgv2(e as any))
    }
  } finally {
    isPublishing.value = false
  }
}

const handlePendingExecutionsContinue = async (cancelPending: boolean) => {
  await handlePublish(cancelPending)
}
</script>

<template>
  <div class="flex justify-between">
    <div class="flex gap-2 w-full">
      <NcTooltip v-if="activeWorkflowHasDraftChanges">
        <NcButton size="small" type="secondary" @click="revertToPublished">
          <template #icon>
            <GeneralIcon icon="reload" />
          </template>
          Discard
        </NcButton>
        <template #title> Discard draft changes and restore published version </template>
      </NcTooltip>

      <NcTooltip v-if="activeWorkflowHasDraftChanges" :disabled="canPublish">
        <NcButton
          size="small"
          type="primary"
          :disabled="!canPublish || isPublishing"
          :loading="isPublishing"
          @click="handlePublish()"
        >
          <template #icon>
            <GeneralIcon icon="ncUploadCloud" />
          </template>
          Publish
        </NcButton>
        <template #title> Please test all nodes before publishing </template>
      </NcTooltip>
    </div>

    <DlgWorkflowPendingExecutions
      v-model:visible="showPendingExecutionsModal"
      :count="pendingExecutionsCount"
      @continue="handlePendingExecutionsContinue"
    />
  </div>
</template>

<style scoped lang="scss"></style>
