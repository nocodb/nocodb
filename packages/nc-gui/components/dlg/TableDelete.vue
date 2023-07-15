<script lang="ts" setup>
import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { UITypes, isSystemColumn } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
  tableId: string
}>()

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)

const { $e, $api } = useNuxtApp()
const { t } = useI18n()
const { closeTab } = useTabs()

const { getMeta, removeMeta } = useMetas()
const { activeProjectId } = storeToRefs(useProjects())
const { loadTables, projectUrl, isXcdbBase } = useProject()
const { refreshCommandPalette } = useCommandPalette()

const { activeTables } = storeToRefs(useTablesStore())
const { openTable } = useTablesStore()

const table = computed(() => activeTables.value.find((t) => t.id === props.tableId))

const isLoading = ref(false)

const onDelete = async () => {
  if (!table.value) return

  const toBeDeletedTable = JSON.parse(JSON.stringify(table.value))

  isLoading.value = true
  try {
    const meta = (await getMeta(toBeDeletedTable.id as string, true)) as TableType
    const relationColumns = meta?.columns?.filter((c) => c.uidt === UITypes.LinkToAnotherRecord && !isSystemColumn(c))

    if (relationColumns?.length && !isXcdbBase(toBeDeletedTable.base_id)) {
      const refColMsgs = await Promise.all(
        relationColumns.map(async (c, i) => {
          const refMeta = (await getMeta((c?.colOptions as LinkToAnotherRecordType)?.fk_related_model_id as string)) as TableType
          return `${i + 1}. ${c.title} is a LinkToAnotherRecord of ${(refMeta && refMeta.title) || c.title}`
        }),
      )
      message.info(
        h('div', {
          innerHTML: `<div style="padding:10px 4px">Unable to delete tables because of the following.
              <br><br>${refColMsgs.join('<br>')}<br><br>
              Delete them & try again</div>`,
        }),
      )
      return
    }

    await $api.dbTable.delete(toBeDeletedTable.id as string)

    await closeTab({
      type: TabType.TABLE,
      id: toBeDeletedTable.id,
      title: toBeDeletedTable.title,
    })

    await loadTables()

    removeMeta(toBeDeletedTable.id as string)
    refreshCommandPalette()
    // Deleted table successfully
    $e('a:table:delete')

    // Navigate to project if no tables left or open first table
    if (activeTables.value.length === 0) {
      await navigateTo(
        projectUrl({
          id: activeProjectId.value!,
          type: 'database',
        }),
      )
    } else {
      await openTable(activeTables.value[0])
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <GeneralModal v-model:visible="visible">
    <div class="flex flex-col p-6">
      <div class="flex flex-row pb-2 mb-4 font-medium text-lg border-b-1 border-gray-50 text-gray-800">
        {{ $t('general.delete') }} {{ $t('objects.table') }}
      </div>

      <div class="mb-3 text-gray-800">Are you sure you want to delete the following table?</div>

      <div v-if="table" class="flex flex-row items-center py-2 px-3.75 bg-gray-50 rounded-lg text-gray-700 mb-4">
        <GeneralTableIcon :meta="table" class="nc-view-icon"></GeneralTableIcon>
        <div
          class="capitalize text-ellipsis overflow-hidden select-none w-full pl-1"
          :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
        >
          {{ table.title }}
        </div>
      </div>

      <div class="flex flex-row items-center py-2 px-3 border-1 border-gray-100 rounded-lg text-gray-700">
        <GeneralIcon icon="warning" class="text-orange-500 pl-1"></GeneralIcon>
        <div class="pl-1.25">This action cannot be undone</div>
      </div>

      <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 border-t-1 border-gray-50 justify-end">
        <a-button key="back" class="!rounded-md !font-medium" @click="visible = false">{{ $t('general.cancel') }}</a-button>

        <a-button
          key="submit"
          class="!rounded-md !font-medium"
          type="danger"
          html-type="submit"
          :loading="isLoading"
          @click="onDelete"
        >
          {{ $t('general.submit') }}
        </a-button>
      </div>
    </div>
  </GeneralModal>
</template>
