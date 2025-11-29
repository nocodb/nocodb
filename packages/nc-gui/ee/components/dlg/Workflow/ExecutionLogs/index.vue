<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
}>()

const emits = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
}>()

const vOpen = useVModel(props, 'modelValue', emits)

const closeModal = () => {
  vOpen.value = false
}

const workflowStore = useWorkflowStore()

const { activeWorkflowId } = storeToRefs(workflowStore)

const { loadWorkflowExecutions } = workflowStore

const isLoading = ref(false)

const executions = ref<any[]>([])
const pageSize = ref(25)
const currentOffset = ref(0)
const hasMore = ref(true)

const _activeItem = ref<any>()
const activeItem = computed<any>({
  get: () => {
    if (_activeItem.value) {
      return _activeItem.value
    }
    // return first item by default if not set
    return executions.value?.[0]
  },
  set: (val) => {
    _activeItem.value = val
  },
})

async function loadExecutionLogs(append = false) {
  try {
    if (!append) {
      isLoading.value = true
      executions.value = []
      currentOffset.value = 0
      hasMore.value = true
    }

    const result = await loadWorkflowExecutions({
      workflowId: activeWorkflowId.value,
      limit: pageSize.value,
      offset: currentOffset.value,
    })

    if (append) {
      executions.value = [...executions.value, ...result]
    } else {
      executions.value = result
    }

    // Check if we have more data
    if (result.length < pageSize.value) {
      hasMore.value = false
      currentOffset.value = currentOffset.value + result.length
    } else {
      currentOffset.value += pageSize.value
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    if (!append) {
      isLoading.value = false
    }
  }
}

async function loadMore() {
  if (!hasMore.value) return
  await loadExecutionLogs(true)
}

onBeforeMount(async () => {
  await loadExecutionLogs()
})

watch(
  () => props.modelValue,
  async (newValue) => {
    if (newValue) {
      await loadExecutionLogs()
    }
  },
)
</script>

<template>
  <NcModal v-model:visible="vOpen" centered size="large" wrap-class-name="nc-modal-execution-logs" @keydown.esc="closeModal">
    <template #header>
      <div class="flex w-full items-center pl-4 pr-3 py-3 justify-between">
        <div class="flex items-center gap-3 flex-1">
          <GeneralIcon icon="audit" class="text-xl" />
          <div class="text-base font-weight-700">Execution Logs</div>
        </div>

        <div class="flex justify-end items-center gap-3 flex-1">
          <NcButton type="text" size="small" data-testid="nc-close-execution-logs-modal" @click.stop="closeModal">
            <GeneralIcon icon="close" />
          </NcButton>
        </div>
      </div>
    </template>

    <div class="h-[calc(100%_-_57px)]">
      <div
        class="h-full"
        :class="{
          'flex items-center justify-center': !executions.length && !isLoading,
        }"
      >
        <a-empty v-if="!executions.length && !isLoading" />
        <div v-else class="flex h-full">
          <div class="min-w-80 border-r-1 h-full">
            <div
              v-if="isLoading"
              class="p-3 h-full flex flex-col gap-3 children:(border-b-1 border-nc-border-medium) overflow-auto nc-scrollbar-thin"
            >
              <a-skeleton
                v-for="idx in 7"
                :key="idx"
                :loading="isLoading"
                active
                :avatar="{ size: 'small' }"
                :paragraph="{
                  rows: 2,
                }"
                :title="false"
              />
            </div>
            <DlgWorkflowExecutionLogsList
              v-else
              v-model:active-item="activeItem"
              :executions="executions"
              :has-more="hasMore"
              @load-more="loadMore"
            />
          </div>
          <div class="flex-grow min-w-100">
            <div v-if="isLoading" class="h-full p-3 overflow-auto nc-scrollbar-thin flex flex-col gap-6">
              <a-skeleton
                active
                :paragraph="false"
                class="!children:children:mt-0"
                :title="{
                  width: '50%',
                }"
              />

              <div class="flex gap-x-5">
                <div class="min-w-80 flex-1">
                  <a-skeleton
                    v-for="idx in 3"
                    :key="idx"
                    :loading="isLoading"
                    active
                    :paragraph="{
                      rows: 1,
                      width: '90%',
                    }"
                    :title="false"
                    class="min-w-80"
                  />
                </div>
                <div class="min-w-80 flex-1">
                  <a-skeleton
                    v-for="idx in 2"
                    :key="idx"
                    :loading="isLoading"
                    active
                    :paragraph="{
                      rows: 1,
                      width: '90%',
                    }"
                    :title="false"
                    class="min-w-80"
                  />
                </div>
              </div>
              <div class="flex-1 flex items-stretch gap-4">
                <div class="flex-1 border-1 border-nc-border-gray-medium rounded-lg p-3">
                  <a-skeleton active :paragraph="{ rows: 4 }" />
                </div>
                <div class="flex-1 border-1 border-nc-border-gray-medium rounded-lg p-3">
                  <a-skeleton active :paragraph="{ rows: 4 }" />
                </div>
              </div>
            </div>
            <DlgWorkflowExecutionLogsDetails v-else :item="activeItem" />
          </div>
        </div>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-execution-logs {
  .nc-modal {
    @apply !p-0;
    height: min(calc(100vh - 100px), 1024px);
    max-height: min(calc(100vh - 100px), 1024px) !important;
  }

  .nc-modal-header {
    @apply !mb-0 !pb-0;
  }
}
</style>
