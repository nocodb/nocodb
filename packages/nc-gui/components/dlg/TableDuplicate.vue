<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'
import { message } from 'ant-design-vue'
import { useVModel } from '#imports'
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
    :closable="!isLoading"
    :mask-closable="!isLoading"
    :keyboard="!isLoading"
    centered
    wrap-class-name="nc-modal-table-duplicate"
    :footer="null"
    class="!w-[30rem]"
    @keydown.esc="dialogShow = false"
  >
    <div>
      <div class="prose-xl font-bold self-center" @dblclick="isEaster = !isEaster">
        {{ $t('general.duplicate') }} {{ $t('objects.table') }}
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
      <NcButton key="submit" v-e="['a:table:duplicate']" type="primary" :loading="isLoading" @click="_duplicate"
        >{{ $t('general.confirm') }}
      </NcButton>
    </div>
  </GeneralModal>
</template>
