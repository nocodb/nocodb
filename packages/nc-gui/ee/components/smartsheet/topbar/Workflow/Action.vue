<script setup lang="ts">
import type { WorkflowGeneralNode } from 'nocodb-sdk'
import { GeneralNodeID } from 'nocodb-sdk'

const workflowStore = useWorkflowStore()

const { activeWorkflowHasDraftChanges, activeWorkflow } = storeToRefs(workflowStore)

const { updateWorkflow, publishWorkflow } = useWorkflowStore()

const isPublishing = ref(false)

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
    if ([GeneralNodeID.TRIGGER, GeneralNodeID.PLUS].includes(node.type as any)) {
      continue
    }

    const testResult = node.data?.testResult

    if (!testResult || testResult?.status !== 'success' || testResult?.isStale === true) {
      return false
    }
  }

  return true
})

const handlePublish = async () => {
  if (!canPublish.value || !activeWorkflow.value?.id) return

  isPublishing.value = true
  try {
    await publishWorkflow(activeWorkflow.value?.id)
  } finally {
    isPublishing.value = false
  }
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
          @click="handlePublish"
        >
          <template #icon>
            <GeneralIcon icon="ncUploadCloud" />
          </template>
          Publish
        </NcButton>
        <template #title> Please test all nodes before publishing </template>
      </NcTooltip>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
