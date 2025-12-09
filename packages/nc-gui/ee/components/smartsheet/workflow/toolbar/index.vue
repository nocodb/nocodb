<script setup lang="ts">
import type { WorkflowGeneralNode } from 'nocodb-sdk'
import { GeneralNodeID, hasWorkflowDraftChanges } from 'nocodb-sdk'
import Tab from './Tab.vue'

const workflowStore = useWorkflowStore()

const { updateWorkflow, publishWorkflow } = workflowStore

const { activeWorkflow } = storeToRefs(workflowStore)

const { $e } = useNuxtApp()

const isPublishing = ref(false)

const hasDraftChanges = computed(() => {
  if (!activeWorkflow.value) return false
  return hasWorkflowDraftChanges(activeWorkflow.value)
})

const canPublish = computed(() => {
  if (!hasDraftChanges.value) return false

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

const toggleWorkflow = async () => {
  if (!activeWorkflow.value || !activeWorkflow.value.base_id || !activeWorkflow.value.id) {
    return
  }
  const newState = !activeWorkflow.value.enabled
  await updateWorkflow(activeWorkflow.value.base_id, activeWorkflow.value?.id, {
    ...activeWorkflow.value,
    enabled: newState,
  })

  $e('a:workflow:toggle', {
    enabled: newState,
    workflow_id: activeWorkflow.value.id,
  })
}

const handlePublish = async () => {
  if (!canPublish.value || !activeWorkflow.value?.id) return

  isPublishing.value = true
  try {
    await publishWorkflow(activeWorkflow.value?.id)
  } finally {
    isPublishing.value = false
  }
}

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
</script>

<template>
  <div class="flex w-full bg-nc-bg-default border-b-1 border-nc-border-gray-medium p-2 h-12 items-center">
    <div class="flex-1">
      <Tab />
    </div>

    <div class="flex items-center gap-2 mr-4">
      <NcTooltip v-if="hasDraftChanges">
        <div
          class="rounded-md flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-600 text-caption border border-orange-200"
        >
          <GeneralIcon icon="edit" class="w-3 h-3" />
          Draft
        </div>
        <template #title> You have unsaved changes </template>
      </NcTooltip>

      <NcTooltip v-if="hasDraftChanges">
        <NcButton size="small" type="secondary" :disabled="isPublishing" @click="revertToPublished">
          <template #icon>
            <GeneralIcon icon="reload" />
          </template>
          Discard
        </NcButton>
        <template #title> Revert to published version </template>
      </NcTooltip>

      <NcTooltip v-if="hasDraftChanges" :disabled="canPublish">
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

      <div
        class="rounded-md flex items-center gap-2 px-2 py-0.5"
        :class="{
          'bg-nc-bg-green-dark text-nc-content-green-dark text-captionBold': activeWorkflow?.enabled,
          'bg-nc-bg-gray-light text-nc-content-gray-muted text-caption': !activeWorkflow?.enabled,
        }"
      >
        <span v-if="activeWorkflow?.enabled" class="ripple-effect" />

        {{ activeWorkflow?.enabled ? 'Live' : 'Paused' }}
      </div>

      <NcSwitch :checked="activeWorkflow?.enabled" @change="toggleWorkflow" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.ripple-effect {
  @apply block w-2 h-2 rounded-full bg-nc-green-600;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    animation: ripple-wave 1s cubic-bezier(0.4, 0, 0.6, 1) 1s infinite;
  }

  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    animation: ripple-wave 1s cubic-bezier(0.4, 0, 0.6, 1) 1s infinite;
  }
}

@keyframes ripple-wave {
  0% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(34, 197, 94, 0);
  }
  100% {
    box-shadow: 0 0 0 8px rgba(34, 197, 94, 0);
  }
}
</style>
