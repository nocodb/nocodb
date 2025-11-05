<script lang="ts" setup>
import type { AutomationType } from 'nocodb-sdk'

interface Props {
  visible: boolean
  automation: AutomationType
}

const props = defineProps<Props>()

const emit = defineEmits(['update:visible', 'deleted'])

const visible = useVModel(props, 'visible', emit)

const automation = toRef(props, 'automation')

const workflowStore = useWorkflowStore()

const { deleteWorkflow } = workflowStore

const { $e } = useNuxtApp()

const onDelete = async () => {
  if (!automation.value) return

  loading.value = true

  try {
    await deleteWorkflow(automation.value.base_id, automation.value.id as string)

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
      <div v-if="automation" class="flex flex-row items-center py-2.25 px-2.5 bg-gray-50 rounded-lg text-gray-700">
        <GeneralIcon class="nc-view-icon" icon="workflow" />

        <div
          class="capitalize text-ellipsis overflow-hidden select-none w-full pl-1.75"
          :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
        >
          {{ automation.title }}
        </div>
      </div>
    </template>
  </GeneralDeleteModal>
</template>
