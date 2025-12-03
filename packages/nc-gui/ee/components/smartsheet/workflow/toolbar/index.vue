<script setup lang="ts">
import Tab from './Tab.vue'

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
  <div class="flex w-full bg-nc-bg-default border-b-1 border-nc-border-gray-medium p-2 h-12 items-center">
    <div class="flex-1">
      <Tab />
    </div>

    <div class="flex items-center gap-2 mr-4">
      <div
        class="rounded-md flex items-center gap-1 px-2 py-0.5"
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
