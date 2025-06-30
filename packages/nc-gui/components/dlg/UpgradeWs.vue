<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  jobId?: string
}>()

const emit = defineEmits(['update:modelValue'])

const vModel = useVModel(props, 'modelValue', emit)

const { $poller } = useNuxtApp()

const workspace = useWorkspace()

const { activeWorkspace } = storeToRefs(workspace)

const lastMessage = ref('')

const completed = ref(false)

const isLoading = ref(false)

function pollJob(jobId: string) {
  isLoading.value = true

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
      if (data.status !== 'close') {
        if (data.status === JobStatus.COMPLETED) {
          completed.value = true
          isLoading.value = false

          workspace.loadWorkspace(activeWorkspace.value!.id!)
        } else if (data.status === JobStatus.FAILED) {
          completed.value = true
          isLoading.value = false

          workspace.loadWorkspace(activeWorkspace.value!.id!)
        } else {
          lastMessage.value = data.data?.message || 'Upgrading workspace...'
        }
      }
    },
  )
}

onMounted(() => {
  if (props.jobId) {
    pollJob(props.jobId)
  }
})
</script>

<template>
  <GeneralModal v-model:visible="vModel" class="!w-[30rem]" wrap-class-name="nc-modal-upgrade-ws">
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <GeneralIcon icon="nocodb1" class="w-5 h-5" />
        <div class="text-lg font-bold self-center">Upgrading Workspace</div>
      </div>

      <div class="flex items-center gap-2">
        <GeneralLoader v-if="isLoading" />
        <div class="text-sm text-gray-500">
          {{ lastMessage }}
        </div>
      </div>

      <NcButton v-if="completed" type="primary" @click="vModel = false"> Done </NcButton>
    </div>
  </GeneralModal>
</template>
