<script setup lang="ts">
import type { BaseType } from 'nocodb-sdk'

const props = defineProps<{
  modelValue: boolean
  base: BaseType
}>()

const emit = defineEmits(['update:modelValue'])

const dialogShow = useVModel(props, 'modelValue', emit)

const { $api, $poller } = useNuxtApp()

const basesStore = useBases()

const { loadProjects } = basesStore

const { activeWorkspaceId } = storeToRefs(useWorkspace())

const { navigateToProject } = useGlobal()

const { refreshCommandPalette } = useCommandPalette()

// Form fields
const title = ref(`${props.base.title} (Sandbox)`.trim().substring(0, 50))
const description = ref('')

// Options
const options = ref({
  includeData: true,
})

// Status
const status = ref<'pending' | 'loading' | 'success' | 'error'>('pending')
const errorMessage = ref('')
const targetBase = ref<BaseType | null>(null)

const isLoading = computed(() => status.value === 'loading')

const createSandbox = async () => {
  if (!props.base?.id || !activeWorkspaceId.value) return

  try {
    status.value = 'loading'

    const response = await $api.internal.postOperation(
      activeWorkspaceId.value,
      props.base.id,
      {
        operation: 'sandboxCreate',
      } as any,
      {
        title: title.value,
        description: description.value,
        options: {
          excludeData: !options.value.includeData,
        },
      },
    )

    if (response?.sandbox_base_id) {
      // Poll for job completion
      $poller.subscribe(
        { id: response.job_id },
        async (data: {
          id: string
          status?: string
          data?: {
            error?: { message: string }
            result?: any
          }
        }) => {
          if (data.status !== 'close') {
            if (data.status === JobStatus.COMPLETED) {
              targetBase.value = { id: response.sandbox_base_id }

              status.value = 'success'
              refreshCommandPalette()
            } else if (data.status === JobStatus.FAILED) {
              status.value = 'error'
              errorMessage.value = data?.data?.error?.message || 'Failed to create sandbox'
              refreshCommandPalette()
            }
          }
        },
      )
    } else {
      // No job, just success
      try {
        await loadProjects('workspace', activeWorkspaceId.value)
      } catch (_e: any) {
        // ignore
      }
      targetBase.value = { id: response?.sandbox_base_id } as BaseType
      status.value = 'success'
      refreshCommandPalette()
    }
  } catch (e: any) {
    status.value = 'error'
    errorMessage.value = await extractSdkResponseErrorMsg(e)
  }
}

const goToSandbox = () => {
  if (!targetBase.value?.id) return

  navigateToProject({
    workspaceId: activeWorkspaceId.value,
    baseId: targetBase.value.id,
    type: 'database',
  })
  dialogShow.value = false
}

const handleActionClick = () => {
  switch (status.value) {
    case 'pending':
      createSandbox()
      break
    case 'success':
      goToSandbox()
      break
    case 'error':
      status.value = 'pending'
      errorMessage.value = ''
      break
  }
}

watch(dialogShow, (newVal) => {
  if (!newVal) {
    // Reset on close
    status.value = 'pending'
    title.value = `${props.base.title} (Sandbox)`.trim().substring(0, 50)
    description.value = ''
    errorMessage.value = ''
    targetBase.value = null
  }
})

onKeyStroke('Enter', () => {
  if (dialogShow.value && status.value === 'pending') {
    createSandbox()
  }
})
</script>

<template>
  <GeneralModal
    v-if="base"
    v-model:visible="dialogShow"
    :mask-style="{
      'background-color': 'rgba(0, 0, 0, 0.08)',
    }"
    :mask-closable="!isLoading"
    :keyboard="!isLoading"
    class="!w-[30rem]"
    wrap-class-name="nc-modal-sandbox-create"
  >
    <div>
      <!-- Header -->
      <div class="text-base text-nc-content-gray-emphasis leading-6 font-bold self-center">
        <template v-if="['pending', 'loading'].includes(status)">
          <div class="flex items-center gap-2">
            <GeneralIcon icon="ncGitBranch" class="w-5 h-5 text-orange-600" />
            <span>Create Sandbox</span>
          </div>
        </template>

        <template v-else-if="status === 'success'">
          <div class="flex items-center gap-2">
            <GeneralIcon class="text-green-600 w-6 h-6" icon="checkFill" />
            <div class="text-nc-content-gray-emphasis font-semibold">Sandbox Created</div>
          </div>
        </template>

        <template v-else-if="status === 'error'">
          <div class="flex items-center gap-2">
            <GeneralIcon icon="ncInfoSolid" class="flex-none !text-red-700 w-6 h-6" />
            <div class="text-nc-content-gray-emphasis font-semibold">Failed to Create Sandbox</div>
          </div>
        </template>
      </div>

      <!-- Content -->
      <template v-if="['pending', 'loading'].includes(status)">
        <div class="mt-5 flex flex-col gap-4">
          <!-- Title -->
          <div>
            <label class="text-nc-content-gray font-medium text-sm mb-1 block">Title</label>
            <a-input v-model:value="title" :disabled="isLoading" placeholder="Enter sandbox title" class="!rounded-lg" />
          </div>

          <!-- Description -->
          <div>
            <label class="text-nc-content-gray font-medium text-sm mb-1 block">Description (optional)</label>
            <a-textarea
              v-model:value="description"
              :disabled="isLoading"
              placeholder="What are you working on in this sandbox?"
              :rows="3"
              class="!rounded-lg"
            />
          </div>

          <!-- Options -->
          <NcDivider />

          <div
            class="flex gap-3 cursor-pointer leading-5 text-nc-content-gray font-medium items-center"
            @click="options.includeData = !options.includeData"
          >
            <NcSwitch :checked="options.includeData" :disabled="isLoading" />
            Include records
          </div>
        </div>
      </template>

      <template v-else-if="status === 'success'">
        <div class="text-nc-content-gray-emphasis my-5 font-medium">
          Sandbox <span class="font-bold">"{{ title }}"</span> has been created successfully. <br /><br />
          You can now make changes to this sandbox. When ready, publish your changes back to the master base.
        </div>
      </template>

      <template v-else-if="status === 'error'">
        <div class="text-nc-content-gray-emphasis my-5 font-medium">
          {{ errorMessage }}
        </div>
      </template>
    </div>

    <!-- Footer -->
    <div class="flex flex-row gap-x-2 justify-end mt-5">
      <NcButton v-if="!isLoading" type="secondary" size="small" @click="dialogShow = false">
        {{ status === 'success' ? 'Close' : $t('general.cancel') }}
      </NcButton>
      <NcButton
        v-e="['a:sandbox:create']"
        size="small"
        :loading="isLoading"
        :disabled="isLoading || (status === 'pending' && !title.trim())"
        @click="handleActionClick"
      >
        <template v-if="status === 'pending'">
          <GeneralIcon icon="ncGitBranch" class="w-4 h-4 mr-1" />
          Create Sandbox
        </template>
        <template v-else-if="status === 'loading'"> Creating Sandbox... </template>
        <template v-else-if="status === 'success'">
          <GeneralIcon icon="ncArrowRight" class="w-4 h-4 mr-1" />
          Go to Sandbox
        </template>
        <template v-else-if="status === 'error'"> Try Again </template>
      </NcButton>
    </div>
  </GeneralModal>
</template>

<style scoped lang="scss">
:deep(.ant-modal-mask) {
  @apply !bg-black !bg-opacity-[8%];
}
</style>
