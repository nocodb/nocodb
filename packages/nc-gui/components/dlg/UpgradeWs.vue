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

type UpgradeState = 'in_progress' | 'completed' | 'failed'

const state = ref<UpgradeState>('in_progress')

const lastMessage = ref('')

function reloadActiveWorkspace() {
  if (!activeWorkspace.value?.id) return
  workspace.loadWorkspace(activeWorkspace.value.id).catch(() => {
    // ignore — the modal is already terminal at this point
  })
}

function pollJob(jobId: string) {
  state.value = 'in_progress'

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
        state.value = 'completed'
        reloadActiveWorkspace()
      } else if (data.status === JobStatus.FAILED) {
        // Intentionally do NOT surface the raw backend error to the customer
        // — migration internals (DB names, transport errors, command output)
        // should not leak. Full details go to telemetry for support lookup.
        state.value = 'failed'
        reloadActiveWorkspace()
      } else {
        lastMessage.value = data.data?.message || t('msg.workspaceUpgradeInProgress')
      }
    },
  )
}

function close() {
  vModel.value = false
}

onMounted(() => {
  if (props.jobId) {
    pollJob(props.jobId)
  }
})

const showSpinner = computed(() => state.value === 'in_progress')

// Customer-facing copy stays positive across both terminal states. Paid-tier
// access doesn't depend on the DB-instance migration succeeding — feature
// availability is tied to the plan, not the physical placement. Real
// failures surface internally via telemetry (migration_failed), not the UI.
const bodyMessage = computed(() => {
  if (state.value === 'completed' || state.value === 'failed') {
    return t('msg.workspaceUpgradeComplete')
  }
  return lastMessage.value || t('msg.workspaceUpgradeInProgress')
})

const showDoneButton = computed(() => state.value !== 'in_progress')

// While the migration is actively running the modal is fully locked — no X,
// no ESC, no mask-click. The customer must NOT be able to resume editing the
// source workspace while data is being copied, since writes during the
// migration window would be silently dropped on cutover (data drift).
// We deliberately do NOT add a frontend "stall" escape hatch: that would
// re-introduce the data-drift risk. The backend is the single source of
// truth for terminal state — retry exhaustion (~3 min) and the migrator's
// 5-min per-command timeout guarantee the job reaches completed/failed
// within bounded time. If a backend bug ever holds the modal open
// indefinitely, support clears db_job_id manually — recoverable and far
// preferable to silent data corruption.
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
        <div class="text-lg font-bold self-center">{{ $t('title.upgradingWorkspace') }}</div>
      </div>

      <div class="flex items-center gap-2">
        <GeneralLoader v-if="showSpinner" />
        <div class="text-sm text-gray-500">
          {{ bodyMessage }}
        </div>
      </div>

      <NcButton v-if="showDoneButton" type="primary" @click="close">
        {{ $t('general.done') }}
      </NcButton>
    </div>
  </GeneralModal>
</template>
