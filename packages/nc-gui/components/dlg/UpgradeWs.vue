<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  jobId?: string
}>()

const emit = defineEmits(['update:modelValue'])

const vModel = useVModel(props, 'modelValue', emit)

const { $poller } = useNuxtApp()

const { t } = useI18n()

const workspace = useWorkspace()

const { activeWorkspace } = storeToRefs(workspace)

type UpgradeState = 'in_progress' | 'completed' | 'failed' | 'stalled'

const state = ref<UpgradeState>('in_progress')

const lastMessage = ref('')

const errorMessage = ref('')

// If no progress update arrives within this window, fall through to the
// stalled state so the modal can never be a permanent dead-end. Generous so a
// big-base migration with long quiet phases between log emissions doesn't trip
// it; this is purely a safety net against a dead job.
const STALL_TIMEOUT_MS = 15 * 60 * 1000

let stallTimer: ReturnType<typeof setTimeout> | null = null

function clearStallTimer() {
  if (stallTimer) {
    clearTimeout(stallTimer)
    stallTimer = null
  }
}

function armStallTimer() {
  clearStallTimer()
  stallTimer = setTimeout(() => {
    if (state.value === 'in_progress') {
      state.value = 'stalled'
    }
  }, STALL_TIMEOUT_MS)
}

function reloadActiveWorkspace() {
  if (!activeWorkspace.value?.id) return
  workspace.loadWorkspace(activeWorkspace.value.id).catch(() => {
    // ignore — the modal is already terminal at this point
  })
}

function pollJob(jobId: string) {
  state.value = 'in_progress'
  armStallTimer()

  $poller.subscribe(
    { id: jobId },
    async (data: {
      id: string
      status?: string
      data?: {
        error?: {
          message: string
        }
        message?: string
        result?: any
      }
    }) => {
      if (data.status === 'close') {
        return
      }

      if (data.status === JobStatus.COMPLETED) {
        clearStallTimer()
        state.value = 'completed'
        reloadActiveWorkspace()
      } else if (data.status === JobStatus.FAILED) {
        clearStallTimer()
        state.value = 'failed'
        errorMessage.value = data.data?.error?.message || data.data?.message || ''
        reloadActiveWorkspace()
      } else {
        armStallTimer()
        lastMessage.value = data.data?.message || t('msg.workspaceUpgradeInProgress')
      }
    },
  )
}

function close() {
  vModel.value = false
}

// Re-read the workspace whenever the modal closes mid-flight so any backend
// self-heal of db_job_id lands in the store and the modal doesn't pop back up.
watch(vModel, (visible) => {
  if (!visible && state.value !== 'completed') {
    reloadActiveWorkspace()
  }
})

onMounted(() => {
  if (props.jobId) {
    pollJob(props.jobId)
  }
})

onBeforeUnmount(() => {
  clearStallTimer()
})

const title = computed(() => {
  if (state.value === 'failed') return t('title.workspaceUpgradeFailed')
  return t('title.upgradingWorkspace')
})

const showSpinner = computed(() => state.value === 'in_progress')

const bodyMessage = computed(() => {
  if (state.value === 'completed') return lastMessage.value
  if (state.value === 'failed') {
    return errorMessage.value || t('msg.workspaceUpgradeFailedHelp')
  }
  if (state.value === 'stalled') return t('msg.workspaceUpgradeStalled')
  return lastMessage.value || t('msg.workspaceUpgradeInProgress')
})

// Only surface the standalone support hint when the body shows the raw error
// from the backend — otherwise the body copy already mentions support.
const showSupportHint = computed(() => state.value === 'failed' && !!errorMessage.value)

const showDoneButton = computed(() => state.value !== 'in_progress')

// While the migration is actively running we must not let the user dismiss
// the modal — they'd resume editing the source workspace and any writes
// during the data copy would silently be dropped on the cutover. Only allow
// dismiss once we're in a terminal/stalled state.
const isDismissable = computed(() => state.value !== 'in_progress')
</script>

<template>
  <GeneralModal
    v-model:visible="vModel"
    :closable="isDismissable"
    :mask-closable="isDismissable"
    :keyboard="isDismissable"
    class="!w-[30rem]"
    wrap-class-name="nc-modal-upgrade-ws"
  >
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <GeneralIcon icon="nocodb1" class="w-5 h-5" />
        <div class="text-lg font-bold self-center">{{ title }}</div>
      </div>

      <div class="flex items-center gap-2">
        <GeneralLoader v-if="showSpinner" />
        <div class="text-sm text-gray-500">
          {{ bodyMessage }}
        </div>
      </div>

      <div v-if="showSupportHint" class="text-sm text-gray-500">
        {{ $t('msg.workspaceUpgradeFailedHelp') }}
      </div>

      <NcButton v-if="showDoneButton" type="primary" @click="close">
        {{ $t('general.done') }}
      </NcButton>
    </div>
  </GeneralModal>
</template>
