<script setup lang="ts">
import { JobStatus } from '~/lib/enums'

interface Emits {
  (event: 'update:modelValue', value: boolean): void
  (event: 'completed', data?: any): void
  (event: 'failed', error?: any): void
}

interface Props {
  modelValue: boolean
  jobId: string
  baseId?: string
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Sync In Progress',
  showCancelBtn: false,
})

const emits = defineEmits<Emits>()

const { $poller } = useNuxtApp()

const dialogShow = useVModel(props, 'modelValue', emits)

const jobId = toRef(props, 'jobId')

const progressRef = ref()

const isLoading = ref(true)

const lastProgress = ref<{ msg: string; status: JobStatus | 'progress' }>()

const listeningForUpdates = ref(false)

const onLog = (data: { message: string }) => {
  progressRef.value?.pushProgress(data.message, 'progress')
  lastProgress.value = { msg: data.message, status: 'progress' }
}

const onStatus = async (status: JobStatus, data?: any) => {
  lastProgress.value = { msg: data?.message, status }

  if (status === JobStatus.COMPLETED) {
    progressRef.value?.pushProgress('Done!', status)
    isLoading.value = false
    emits('completed', data)
  } else if (status === JobStatus.FAILED) {
    progressRef.value?.pushProgress(data?.error?.message || 'Sync failed', status)
    isLoading.value = false
    emits('failed', data?.error)
  }
}

async function listenForUpdates() {
  if (listeningForUpdates.value || !jobId.value) return

  listeningForUpdates.value = true
  isLoading.value = true

  $poller.subscribe(
    { id: jobId.value },
    (data: {
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
      if (data.status !== 'close') {
        if (data.status) {
          onStatus(data.status as JobStatus, data.data)
        } else {
          onLog(data.data as any)
        }
      } else {
        listeningForUpdates.value = false
        isLoading.value = false
      }
    },
  )
}

const stopListening = () => {
  $poller.unsubscribe({ id: jobId.value })
  listeningForUpdates.value = false
}

const handleCancel = () => {
  stopListening()
  dialogShow.value = false
}

const isInProgress = computed(() => {
  return !lastProgress.value || ![JobStatus.COMPLETED, JobStatus.FAILED].includes(lastProgress.value?.status as JobStatus)
})

const canClose = computed(() => {
  return !isInProgress.value
})

watch(
  jobId,
  (newJobId) => {
    if (newJobId && dialogShow.value) {
      listenForUpdates()
    }
  },
  { immediate: true },
)

watch(dialogShow, (isVisible) => {
  if (isVisible && jobId.value && !listeningForUpdates.value) {
    listenForUpdates()
  }
})

onBeforeUnmount(() => {
  stopListening()
})
</script>

<template>
  <NcModal
    v-model:visible="dialogShow"
    size="sm"
    height="auto"
    :centered="false"
    class="!top-[25vh]"
    :closable="canClose"
    :keyboard="canClose"
    :mask-closable="canClose"
    wrap-class-name="nc-modal-sync-in-progress"
    @keydown.esc="canClose && (dialogShow = false)"
  >
    <div class="flex flex-col gap-5">
      <div class="flex justify-between w-full items-center">
        <div class="flex flex-row items-center gap-x-2 text-base font-semibold text-nc-content-gray">
          <GeneralIcon icon="sync" class="!text-green-700 w-5 h-5" />
          <span v-if="isInProgress">{{ title }}...</span>
          <span v-else-if="lastProgress?.status === JobStatus.COMPLETED">Sync Completed</span>
          <span v-else-if="lastProgress?.status === JobStatus.FAILED">Sync Failed</span>
        </div>
      </div>

      <GeneralProgressPanel ref="progressRef" class="w-full h-70" />
    </div>

    <div class="flex justify-end gap-2 mt-5">
      <NcButton v-if="isInProgress" type="secondary" size="small" @click="handleCancel"> Cancel </NcButton>

      <NcButton
        v-if="!isInProgress && lastProgress?.status === JobStatus.FAILED"
        type="secondary"
        size="small"
        @click="dialogShow = false"
      >
        Close
      </NcButton>

      <NcButton
        :disabled="isInProgress || lastProgress?.status !== JobStatus.COMPLETED"
        type="primary"
        size="small"
        @click="dialogShow = false"
      >
        Done
      </NcButton>
    </div>
  </NcModal>
</template>

<style scoped lang="scss"></style>
