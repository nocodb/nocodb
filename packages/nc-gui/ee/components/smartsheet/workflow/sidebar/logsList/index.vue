<script setup lang="ts">
import dayjs from 'dayjs'
import { EventType } from 'nocodb-sdk'
import type { WorkflowExecutionPayload } from 'nocodb-sdk'
import List from './List.vue'

const { $ncSocket } = useNuxtApp()

const workflowStore = useWorkflowStore()

const { activeWorkflowId } = storeToRefs(workflowStore)

const { loadWorkflowExecutions } = workflowStore

const { viewExecution, exitExecutionView, viewingExecution } = useWorkflowOrThrow()

const { base } = storeToRefs(useBase())

const activeExecutionListener = ref<string | null>(null)

const isLoading = ref(false)
const isLoadingMore = ref(false)

const executions = ref<any[]>([])

const pageSize = ref(25)

const hasMore = ref(true)

const _activeItem = ref<any>()

const activeItem = computed<any>({
  get: () => {
    if (_activeItem.value) {
      return _activeItem.value
    }
    // return first item by default if not set
    return null
  },
  set: (val) => {
    _activeItem.value = val
    // When an execution is selected, view it
    if (val) {
      viewExecution(val)
    }
  },
})

const handleBackClick = () => {
  exitExecutionView()
  _activeItem.value = null
}

async function loadExecutionLogs(append = false) {
  if (isLoading.value || isLoadingMore.value) return

  try {
    if (!append) {
      isLoading.value = true
      executions.value = []
      hasMore.value = true
    } else {
      isLoadingMore.value = true
    }

    // Use cursor-based pagination: get executions older than the last one in the list
    const lastExecution = append && executions.value.length > 0 ? executions.value[executions.value.length - 1] : null

    const result = await loadWorkflowExecutions({
      workflowId: activeWorkflowId.value,
      limit: pageSize.value,
      ...(lastExecution && { cursorId: lastExecution.id }),
    })

    if (append) {
      executions.value = [...executions.value, ...result]
    } else {
      executions.value = result
    }

    // Check if we have more data
    if (result.length < pageSize.value) {
      hasMore.value = false
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    if (!append) {
      isLoading.value = false
    } else {
      isLoadingMore.value = false
    }
  }
}

async function loadMore() {
  if (!hasMore.value || isLoadingMore.value) return
  await loadExecutionLogs(true)
}

watch(
  [activeWorkflowId, () => base.value?.id],
  ([newWorkflowId, newBaseId], [oldWorkflowId, _oldBaseId]) => {
    // Unsubscribe from old listener
    if (activeExecutionListener.value) {
      $ncSocket.offMessage(activeExecutionListener.value)
      activeExecutionListener.value = null
    }

    // Subscribe to new workflow's executions if we have all required IDs
    if (newWorkflowId && newBaseId && base.value?.fk_workspace_id) {
      activeExecutionListener.value = $ncSocket.onMessage(
        `${EventType.WORKFLOW_EXECUTION_EVENT}:${base.value.fk_workspace_id}:${newBaseId}:${newWorkflowId}`,
        (data: WorkflowExecutionPayload) => {
          const { id, action, payload } = data

          if (action === 'create') {
            executions.value = [payload, ...executions.value]
          } else if (action === 'update') {
            const index = executions.value.findIndex((e) => e.id === id)
            if (index !== -1) {
              executions.value[index] = { ...executions.value[index], ...payload }
            }
          }
        },
      )
    }

    if (newWorkflowId && newWorkflowId !== oldWorkflowId) {
      loadExecutionLogs()
    }
  },
  { immediate: true },
)

const unsubscribeActiveChannels = (): void => {
  if (activeExecutionListener.value) {
    $ncSocket.offMessage(activeExecutionListener.value)
  }
}

onBeforeUnmount(() => {
  unsubscribeActiveChannels()
})

onBeforeMount(async () => {
  await loadExecutionLogs()
})
</script>

<template>
  <div class="logs-container">
    <div class="border-b-1 border-nc-border-gray-medium py-2 px-1 flex items-center gap-1">
      <NcButton v-if="viewingExecution" type="text" size="small" @click="handleBackClick">
        <GeneralIcon icon="ncChevronLeft" />
      </NcButton>
      <div class="text-bodyBold py-2 px-2">Run history</div>
    </div>
    <List
      v-if="!viewingExecution"
      v-model:active-item="activeItem"
      :executions="executions"
      :has-more="hasMore"
      @load-more="loadMore"
    />
    <div v-else class="flex flex-col p-4 gap-4">
      <div class="flex flex-col gap-3">
        <div class="text-bodyBold text-nc-content-gray">Execution Details</div>

        <div class="flex items-center gap-2">
          <div class="text-bodySm text-nc-content-gray-muted w-24">Status:</div>
          <div class="flex items-center gap-1.5">
            <div v-if="viewingExecution.status === 'success'" class="w-2 h-2 rounded-full bg-green-500" />
            <div v-else-if="viewingExecution.status === 'error'" class="w-2 h-2 rounded-full bg-red-500" />
            <div v-else class="w-2 h-2 rounded-full bg-gray-400" />
            <span class="text-bodySm text-nc-content-gray capitalize">
              {{ viewingExecution.status || 'Unknown' }}
            </span>
          </div>
        </div>
        <div class="flex items-start gap-2">
          <div class="text-bodySm text-nc-content-gray-muted w-24">Executed at:</div>
          <div class="text-bodySm text-nc-content-gray">
            {{ viewingExecution.started_at ? dayjs(viewingExecution.started_at).format('YYYY-MM-DD HH:mm:ss') : '-' }}
          </div>
        </div>
        <div class="flex items-start gap-2">
          <div class="text-bodySm text-nc-content-gray-muted w-24">Finished at:</div>
          <div class="text-bodySm text-nc-content-gray">
            {{ viewingExecution.finished_at ? dayjs(viewingExecution.finished_at).format('YYYY-MM-DD HH:mm:ss') : '-' }}
          </div>
        </div>

        <div v-if="viewingExecution" class="flex items-center gap-2">
          <div class="text-bodySm text-nc-content-gray-muted w-24">Duration:</div>
          <div class="text-bodySm text-nc-content-gray">
            {{ dayjs(viewingExecution.finished_at).diff(viewingExecution.started_at, 'ms') }}ms
          </div>
        </div>
      </div>
    </div>
    <template v-if="viewingExecution">
      <NcDivider />
      <div class="flex items-center p-4 text-nc-content-gray-muted text-bodySm">
        Click on a node in the canvas to view its execution details
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.logs-container {
  @apply flex flex-col h-full;
}
</style>
