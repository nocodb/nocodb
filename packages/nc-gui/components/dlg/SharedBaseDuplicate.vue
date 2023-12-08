<script setup lang="ts">
import { ProjectTypes } from 'nocodb-sdk'
import { isEeUI, useApi, useVModel, useWorkspace } from '#imports'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const { api } = useApi()

const { sharedBaseId } = useCopySharedBase()

const workspaceStore = useWorkspace()

const { populateWorkspace } = workspaceStore

const { workspacesList } = storeToRefs(workspaceStore)

const { ncNavigateTo } = useGlobal()

const dialogShow = useVModel(props, 'modelValue', emit)

const options = ref({
  includeData: true,
  includeViews: true,
})

const optionsToExclude = computed(() => {
  const { includeData, includeViews } = options.value
  return {
    excludeData: !includeData,
    excludeViews: !includeViews,
  }
})

const isLoading = ref(false)

const selectedWorkspace = ref<string>()

const { $e, $poller } = useNuxtApp()

const _duplicate = async () => {
  if (!selectedWorkspace.value && isEeUI) return

  try {
    isLoading.value = true
    const jobData = await api.base.duplicateShared(selectedWorkspace.value ?? 'nc', sharedBaseId.value, {
      options: optionsToExclude.value,
      base: isEeUI
        ? {
            fk_workspace_id: selectedWorkspace.value,
            type: ProjectTypes.DATABASE,
          }
        : {},
    })

    sharedBaseId.value = null

    $poller.subscribe(
      { id: jobData.id },
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
            console.log('job completed', jobData)
            await ncNavigateTo({
              ...(isEeUI ? { workspaceId: jobData.fk_workspace_id } : {}),
              baseId: jobData.base_id,
            })
            isLoading.value = false
            dialogShow.value = false
          } else if (data.status === JobStatus.FAILED) {
            message.error('Failed to duplicate shared base')
            await populateWorkspace()
            isLoading.value = false
            dialogShow.value = false
          }
        }
      },
    )

    $e('a:base:duplicate-shared-base')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
    isLoading.value = false
    dialogShow.value = false
  }
}
</script>

<template>
  <GeneralModal v-model:visible="dialogShow" class="!w-[30rem]" wrap-class-name="nc-modal-project-duplicate">
    <div>
      <div class="prose-xl font-bold self-center">{{ $t('general.duplicate') }} {{ $t('labels.sharedBase') }}</div>
      <template v-if="isEeUI">
        <div class="my-4">Select workspace to duplicate shared base to:</div>

        <NcSelect
          v-model:value="selectedWorkspace"
          class="w-full"
          :options="workspacesList.map((w) => ({ label: `${w.title[0].toUpperCase()}${w.title.slice(1)}`, value: w.id }))"
          placeholder="Select Workspace"
        />
      </template>

      <div class="prose-md self-center text-gray-500 mt-4">{{ $t('title.advancedSettings') }}</div>

      <a-divider class="!m-0 !p-0 !my-2" />

      <div class="text-xs p-2">
        <a-checkbox v-model:checked="options.includeData">{{ $t('labels.includeData') }}</a-checkbox>
        <a-checkbox v-model:checked="options.includeViews">{{ $t('labels.includeView') }}</a-checkbox>
      </div>
    </div>
    <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 justify-end">
      <NcButton key="back" type="secondary" @click="dialogShow = false">{{ $t('general.cancel') }}</NcButton>
      <NcButton
        key="submit"
        v-e="['a:shared-base:duplicate']"
        :loading="isLoading"
        :disabled="!selectedWorkspace && isEeUI"
        @click="_duplicate"
        >{{ $t('general.confirm') }}
      </NcButton>
    </div>
  </GeneralModal>
</template>
