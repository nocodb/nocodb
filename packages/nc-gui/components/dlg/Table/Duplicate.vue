<script setup lang="ts">
import { type LinkToAnotherRecordType, type TableType, UITypes } from 'nocodb-sdk'
import type { TabType } from '#imports'

const props = defineProps<{
  modelValue: boolean
  table: TableType
}>()

const emit = defineEmits(['update:modelValue'])

const { api } = useApi()

const dialogShow = useVModel(props, 'modelValue', emit)

const { addTab } = useTabs()

const { $e, $poller } = useNuxtApp()

const basesStore = useBases()

const { createProject: _createProject } = basesStore

const { openTable } = useTablesStore()

const baseStore = useBase()

const { loadTables } = baseStore

const { tables } = storeToRefs(baseStore)

const { getMeta } = useMetas()

const { t } = useI18n()

const { activeTable: _activeTable } = storeToRefs(useTablesStore())

const { refreshCommandPalette } = useCommandPalette()

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
    const jobData = await api.dbTable.duplicate(props.table.base_id!, props.table.id!, { options: optionsToExclude.value })

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
            const sourceTable = await getMeta(props.table.id!)
            if (sourceTable) {
              for (const col of sourceTable.columns || []) {
                if ([UITypes.Links, UITypes.LinkToAnotherRecord].includes(col.uidt as UITypes)) {
                  if (col && col.colOptions) {
                    const relatedTableId = (col.colOptions as LinkToAnotherRecordType)?.fk_related_model_id
                    if (relatedTableId) {
                      await getMeta(relatedTableId, true)
                    }
                  }
                }
              }
            }

            await loadTables()
            refreshCommandPalette()
            const newTable = tables.value.find((el) => el.id === data?.data?.result?.id)
            if (newTable) addTab({ title: newTable.title, id: newTable.id, type: newTable.type as TabType })

            openTable(newTable!)
            isLoading.value = false
            dialogShow.value = false
          } else if (data.status === JobStatus.FAILED) {
            message.error(t('msg.error.failedToDuplicateTable'))
            await loadTables()
            isLoading.value = false
            dialogShow.value = false
          }
        }
      },
    )

    $e('a:table:duplicate')
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
    v-model:visible="dialogShow"
    :class="{ active: dialogShow }"
    :mask-closable="!isLoading"
    :keyboard="!isLoading"
    centered
    wrap-class-name="nc-modal-table-duplicate"
    :mask-style="{
      'background-color': 'rgba(0, 0, 0, 0.08)',
    }"
    :footer="null"
    class="!w-[30rem]"
    @keydown.esc="dialogShow = false"
  >
    <div>
      <div class="text-base text-nc-content-gray-emphasis leading-6 font-bold self-center" @dblclick="isEaster = !isEaster">
        {{ $t('general.duplicate') }} {{ $t('objects.table') }} "{{ table.title }}"
      </div>

      <div class="mt-5 flex gap-3 flex-col">
        <div
          class="flex gap-3 cursor-pointer leading-5 text-nc-content-gray font-medium items-center"
          @click="options.includeData = !options.includeData"
        >
          <NcSwitch :checked="options.includeData" />
          {{ $t('labels.includeRecords') }}
        </div>
        <div
          class="flex gap-3 cursor-pointer leading-5 text-nc-content-gray font-medium items-center"
          @click="options.includeViews = !options.includeViews"
        >
          <NcSwitch :checked="options.includeViews" />
          {{ $t('labels.includeView') }}
        </div>

        <div
          v-show="isEaster"
          class="flex gap-3 cursor-pointer leading-5 text-nc-content-gray font-medium items-center"
          @click="options.includeHooks = !options.includeHooks"
        >
          <NcSwitch :checked="options.includeHooks" />
          {{ $t('labels.includeWebhook') }}
        </div>
      </div>
    </div>
    <div class="flex flex-row gap-x-2 mt-5 justify-end">
      <NcButton v-if="!isLoading" key="back" type="secondary" size="small" @click="dialogShow = false">{{
        $t('general.cancel')
      }}</NcButton>
      <NcButton key="submit" v-e="['a:table:duplicate']" type="primary" size="small" :loading="isLoading" @click="_duplicate">
        Duplicate Table
      </NcButton>
    </div>
  </GeneralModal>
</template>
