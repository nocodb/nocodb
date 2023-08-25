<script setup lang="ts">
import tinycolor from 'tinycolor2'
import type { ProjectType } from 'nocodb-sdk'
import { useVModel } from '#imports'

const props = defineProps<{
  modelValue: boolean
  project: ProjectType
  onOk: (jobData: { name: string; id: string }) => Promise<void>
}>()

const emit = defineEmits(['update:modelValue'])

const { api } = useApi()

const dialogShow = useVModel(props, 'modelValue', emit)

const options = ref({
  includeData: true,
  includeViews: true,
  includeHooks: true,
})

const optionsToExclude = computed(() => {
  const { includeData, includeViews, includeHooks } = options.value
  return {
    excludeData: !includeData,
    excludeViews: !includeViews,
    excludeHooks: !includeHooks,
  }
})

const isLoading = ref(false)

const _duplicate = async () => {
  try {
    isLoading.value = true
    // pick a random color from array and assign to project
    const color = projectThemeColors[Math.floor(Math.random() * 1000) % projectThemeColors.length]
    const tcolor = tinycolor(color)

    const complement = tcolor.complement()

    const jobData = await api.project.duplicate(props.project.id as string, {
      options: optionsToExclude.value,
      project: {
        fk_workspace_id: props.project.fk_workspace_id,
        type: props.project.type,
        color,
        meta: JSON.stringify({
          theme: {
            primaryColor: color,
            accentColor: complement.toHex8String(),
          },
        }),
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

onKeyStroke('Enter', () => {
  // should only trigger this when our modal is open
  if (dialogShow.value) {
    _duplicate()
  }
})

const isEaster = ref(false)
</script>

<template>
  <GeneralModal v-if="project" v-model:visible="dialogShow" class="!w-[30rem]" wrap-class-name="nc-modal-project-duplicate">
    <div>
      <div class="prose-xl font-bold self-center" @dblclick="isEaster = !isEaster">
        {{ $t('general.duplicate') }} {{ $t('objects.project') }}
      </div>

      <div class="mt-4">Are you sure you want to duplicate the `{{ project.title }}` project?</div>

      <div class="prose-md self-center text-gray-500 mt-4">{{ $t('title.advancedSettings') }}</div>

      <a-divider class="!m-0 !p-0 !my-2" />

      <div class="text-xs p-2">
        <a-checkbox v-model:checked="options.includeData">Include data</a-checkbox>
        <a-checkbox v-model:checked="options.includeViews">Include views</a-checkbox>
        <a-checkbox v-show="isEaster" v-model:checked="options.includeHooks">Include webhooks</a-checkbox>
      </div>
    </div>
    <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 justify-end">
      <NcButton key="back" type="secondary" @click="dialogShow = false">{{ $t('general.cancel') }}</NcButton>
      <NcButton key="submit" :loading="isLoading" @click="_duplicate">{{ $t('general.confirm') }} </NcButton>
    </div>
  </GeneralModal>
</template>
