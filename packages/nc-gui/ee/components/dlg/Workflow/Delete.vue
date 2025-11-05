<script lang="ts" setup>
import type { WorkflowType } from 'nocodb-sdk'

interface Props {
  visible: boolean
  workflow: WorkflowType
}

const props = defineProps<Props>()

const emit = defineEmits(['update:visible', 'deleted'])

const visible = useVModel(props, 'visible', emit)

const workflow = toRef(props, 'workflow')

const workflowStore = useWorkflowStore()

const { deleteWorkflow } = workflowStore

const { $e } = useNuxtApp()

const onDelete = async () => {
  if (!workflow.value) return

  loading.value = true

  try {
    await deleteWorkflow(workflow.value.base_id, workflow.value.id as string)

    $e('a:workflow:delete')

    emit('deleted')
  } finally {
    loading.value = false
  }
}

const loading = ref(false)
</script>

<template>
  <GeneralDeleteModal v-model:visible="visible" entity-name="Workflow" :on-delete="onDelete">
    <template #entity-preview>
      <div v-if="workflow" class="flex flex-row items-center py-2.25 px-2.5 bg-gray-50 rounded-lg text-gray-700">
        <GeneralIcon class="nc-view-icon" icon="workflow" />

        <div
          class="capitalize text-ellipsis overflow-hidden select-none w-full pl-1.75"
          :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
        >
          {{ workflow.title }}
        </div>
      </div>
    </template>
  </GeneralDeleteModal>
</template>
