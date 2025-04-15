<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'

const props = defineProps<{
  modelValue: boolean
  column: ColumnType
  extra: any
}>()

const emit = defineEmits(['update:modelValue'])

const { api } = useApi()

const dialogShow = useVModel(props, 'modelValue', emit)

const { $e, $poller } = useNuxtApp()

const { activeTable: _activeTable } = storeToRefs(useTablesStore())

const reloadDataHook = inject(ReloadViewDataHookInj)

const { eventBus } = useSmartsheetStoreOrThrow()

const { getMeta } = useMetas()

const meta = inject(MetaInj, ref())

const options = ref({
  includeData: true,
})

const optionsToExclude = computed(() => {
  const { includeData } = options.value
  return {
    excludeData: !includeData,
  }
})

const isLoading = ref(false)

const reloadTable = async () => {
  await getMeta(meta!.value!.id!, true)
  eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
  reloadDataHook?.trigger()
}

const _duplicate = async () => {
  try {
    isLoading.value = true
    const jobData = await api.dbTable.duplicateColumn(props.column.base_id!, props.column.id!, {
      options: optionsToExclude.value,
      extra: props.extra,
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
            reloadTable()
            isLoading.value = false
            dialogShow.value = false
          } else if (data.status === JobStatus.FAILED) {
            message.error(`There was an error duplicating the column.`)
            reloadTable()
            isLoading.value = false
            dialogShow.value = false
          }
        }
      },
    )

    $e('a:column:duplicate')
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

defineExpose({
  duplicate: _duplicate,
})
</script>

<template>
  <GeneralModal
    v-model:visible="dialogShow"
    :class="{ active: dialogShow }"
    :mask-closable="!isLoading"
    :keyboard="!isLoading"
    centered
    :mask-style="{
      'background-color': 'rgba(0, 0, 0, 0.08)',
    }"
    wrap-class-name="nc-modal-column-duplicate"
    :footer="null"
    class="!w-[30rem]"
    @keydown.esc="dialogShow = false"
  >
    <div>
      <div class="text-base text-nc-content-gray-emphasis leading-6 font-bold self-center">
        {{ $t('general.duplicate') }} {{ $t('objects.column') }} "{{ column.title }}"
      </div>

      <div class="mt-5 flex gap-3 flex-col">
        <div
          class="flex gap-3 cursor-pointer leading-5 text-nc-content-gray font-medium items-center"
          @click="options.includeData = !options.includeData"
        >
          <NcSwitch :checked="options.includeData" />
          {{ $t('labels.includeData') }}
        </div>
      </div>
    </div>
    <div class="flex flex-row gap-x-2 mt-5 justify-end">
      <NcButton v-if="!isLoading" key="back" type="secondary" size="small" @click="dialogShow = false">
        {{ $t('general.cancel') }}
      </NcButton>
      <NcButton key="submit" type="primary" size="small" :loading="isLoading" @click="_duplicate"> Duplicate Field </NcButton>
    </div>
  </GeneralModal>
</template>
