<script lang="ts" setup>
import type { LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { UITypes, isSystemColumn } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
  tableId: string
  projectId: string
}>()

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)

const { $e, $api } = useNuxtApp()
const { closeTab } = useTabs()

const { getMeta, removeMeta } = useMetas()

const { loadTables, projectUrl, isXcdbBase } = useProject()
const { refreshCommandPalette } = useCommandPalette()

const { projectTables, activeTable } = storeToRefs(useTablesStore())
const { openTable } = useTablesStore()

const tables = computed(() => projectTables.value.get(props.projectId) ?? [])

const table = computed(() => tables.value.find((t) => t.id === props.tableId))

const isLoading = ref(false)

const onDelete = async () => {
  if (!table.value) return

  const toBeDeletedTable = JSON.parse(JSON.stringify(table.value))
  // As when table is deleted, activeTable is set to null
  // But in post process logic we need to know the old active table id
  const oldActiveTableId = activeTable.value?.id

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

    if (oldActiveTableId === toBeDeletedTable.id) {
      // Navigate to project if no tables left or open first table
      if (tables.value.length === 0) {
        await navigateTo(
          projectUrl({
            id: props.projectId,
            type: 'database',
          }),
        )
      } else {
        await openTable(tables.value[0])
      }
    }

    const tableIndex = tables.value.findIndex((t) => t.id === toBeDeletedTable.id)
    if (tableIndex > -1) {
      tables.value.splice(tableIndex, 1)
    }

    visible.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <GeneralDeleteModal v-model:visible="visible" :entity-name="$t('objects.table')" :on-delete="onDelete">
    <template #entity-preview>
      <div v-if="table" class="flex flex-row items-center py-2.25 px-2.5 bg-gray-50 rounded-lg text-gray-700 mb-4">
        <GeneralTableIcon :meta="table" class="nc-view-icon"></GeneralTableIcon>
        <div
          class="capitalize text-ellipsis overflow-hidden select-none w-full pl-1.75"
          :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
        >
          {{ table.title }}
        </div>
      </div>
    </template>
  </GeneralDeleteModal>
</template>
