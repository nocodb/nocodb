<script setup lang="ts">
import tinycolor from 'tinycolor2'
import type { BaseType } from 'nocodb-sdk'
import { isEeUI, useVModel } from '#imports'

const props = defineProps<{
  modelValue: boolean
  base: BaseType
}>()

const emit = defineEmits(['update:modelValue'])

const { refreshCommandPalette } = useCommandPalette()

const { api } = useApi()

const { $e, $poller } = useNuxtApp()

const basesStore = useBases()

const { loadProjects, createProject: _createProject } = basesStore
const { bases } = storeToRefs(basesStore)

const { navigateToProject } = useGlobal()

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
    // pick a random color from array and assign to base
    const color = baseThemeColors[Math.floor(Math.random() * 1000) % baseThemeColors.length]
    const tcolor = tinycolor(color)

    const complement = tcolor.complement()

    const jobData = await api.base.duplicate(props.base.id as string, {
      options: optionsToExclude.value,
      base: {
        fk_workspace_id: props.base.fk_workspace_id,
        type: props.base.type,
        color,
        meta: JSON.stringify({
          theme: {
            primaryColor: color,
            accentColor: complement.toHex8String(),
          },
        }),
      },
    })

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
            await loadProjects('workspace')
            const base = bases.value.get(jobData.base_id)

            // open project after duplication
            if (base) {
              await navigateToProject({
                workspaceId: isEeUI ? base.fk_workspace_id : undefined,
                baseId: base.id,
                type: base.type,
              })
            }
            refreshCommandPalette()
            isLoading.value = false
            dialogShow.value = false
          } else if (data.status === JobStatus.FAILED) {
            message.error('Failed to duplicate project')
            await loadProjects('workspace')
            refreshCommandPalette()
            isLoading.value = false
            dialogShow.value = false
          }
        }
      },
    )

    $e('a:base:duplicate')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
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
  <GeneralModal
    v-if="base"
    v-model:visible="dialogShow"
    :closable="!isLoading"
    :mask-closable="!isLoading"
    :keyboard="!isLoading"
    class="!w-[30rem]"
    wrap-class-name="nc-modal-base-duplicate"
  >
    <div>
      <div class="prose-xl font-bold self-center" @dblclick="isEaster = !isEaster">
        {{ $t('general.duplicate') }} {{ $t('objects.project') }}
      </div>

      <div class="mt-4">{{ $t('msg.warning.duplicateProject') }}</div>

      <div class="prose-md self-center text-gray-500 mt-4">{{ $t('title.advancedSettings') }}</div>

      <a-divider class="!m-0 !p-0 !my-2" />

      <div class="text-xs p-2">
        <a-checkbox v-model:checked="options.includeData" :disabled="isLoading">{{ $t('labels.includeData') }}</a-checkbox>
        <a-checkbox v-model:checked="options.includeViews" :disabled="isLoading">{{ $t('labels.includeView') }}</a-checkbox>
        <a-checkbox v-show="isEaster" v-model:checked="options.includeHooks" :disabled="isLoading">
          {{ $t('labels.includeWebhook') }}
        </a-checkbox>
      </div>
    </div>
    <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 justify-end">
      <NcButton v-if="!isLoading" key="back" type="secondary" @click="dialogShow = false">{{ $t('general.cancel') }}</NcButton>
      <NcButton key="submit" v-e="['a:base:duplicate']" :loading="isLoading" @click="_duplicate"
        >{{ $t('general.confirm') }}
      </NcButton>
    </div>
  </GeneralModal>
</template>
