<script setup lang="ts">
import tinycolor from 'tinycolor2'
import { ProjectTypes, type BaseType } from 'nocodb-sdk'
import { useApi, useVModel, useWorkspace } from '#imports'

const props = defineProps<{
  modelValue: boolean
  sharedBaseId: string
  onOk: (jobData: { name: string; id: string }) => Promise<void>
}>()

const emit = defineEmits(['update:modelValue'])

const { api } = useApi()

const { workspacesList } = storeToRefs(useWorkspace())

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

onMounted(() => {
  console.log(props.sharedBaseId)
})

const isLoading = ref(false)

const selectedWorkspace = ref<string>()

const _duplicate = async () => {
  if (!selectedWorkspace.value) return
  try {
    isLoading.value = true
    // pick a random color from array and assign to base
    // const color = projectThemeColors[Math.floor(Math.random() * 1000) % projectThemeColors.length]
    // const tcolor = tinycolor(color)

    //  const complement = tcolor.complement()

    const jobData = await api.base.duplicateShared(selectedWorkspace.value, props.sharedBaseId, {
      options: optionsToExclude.value,
      base: {
        fk_workspace_id: selectedWorkspace.value,
        type: ProjectTypes.DATABASE,
        /* color,
        meta: JSON.stringify({
          theme: {
            primaryColor: color,
            accentColor: complement.toHex8String(),
          },
        }), */
      },
    })
    props.onOk(jobData as any)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
    dialogShow.value = false
  }
}
</script>

<template>
  <GeneralModal v-model:visible="dialogShow" class="!w-[30rem]" wrap-class-name="nc-modal-project-duplicate">
    <div>
      <div class="prose-xl font-bold self-center">{{ $t('general.duplicate') }} {{ $t('labels.sharedBase') }}</div>

      <div class="my-4">Select workspace to duplicate shared base to:</div>

      <NcSelect
        v-model:value="selectedWorkspace"
        class="w-full"
        :options="workspacesList.map((w) => ({ label: w.title, value: w.id }))"
        placeholder="Select Workspace"
      />

      <div class="prose-md self-center text-gray-500 mt-4">{{ $t('title.advancedSettings') }}</div>

      <a-divider class="!m-0 !p-0 !my-2" />

      <div class="text-xs p-2">
        <a-checkbox v-model:checked="options.includeData">{{ $t('labels.includeData') }}</a-checkbox>
        <a-checkbox v-model:checked="options.includeViews">{{ $t('labels.includeView') }}</a-checkbox>
      </div>
    </div>
    <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 justify-end">
      <NcButton key="back" type="secondary" @click="dialogShow = false">{{ $t('general.cancel') }}</NcButton>
      <NcButton key="submit" v-e="['a:base:duplicate']" :loading="isLoading" :disabled="!selectedWorkspace" @click="_duplicate"
        >{{ $t('general.confirm') }}
      </NcButton>
    </div>
  </GeneralModal>
</template>
