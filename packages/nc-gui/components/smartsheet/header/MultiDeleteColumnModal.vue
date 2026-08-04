<script lang="ts" setup>
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { RelationTypes, isLinkV2, isLinksOrLTAR, isSystemColumn } from 'nocodb-sdk'

// Bulk-delete confirmation modal listing each selected field. Mirrors the
// single-column DeleteColumnModal but loops the columnDelete call over the
// full list and refreshes meta + related metas once at the end.
const props = defineProps<{
  visible: boolean
  columns: ColumnType[]
  onDeleted?: () => void
}>()

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)

const { $api, $e } = useNuxtApp()

const { eventBus } = useSmartsheetStoreOrThrow()

const meta = inject(MetaInj, ref())

const { getMeta } = useMetas()

const { includeM2M } = useGlobal()

const { loadTables } = useBase()

const viewsStore = useViewsStore()

const { t } = useI18n()

// Filter out PVs / system columns / synced readonly defensively — UI should
// already block these but a multi-select might mix in an undeletable one.
const deletableColumns = computed(() => props.columns.filter((c) => !!c.id && !c.pk && !c.pv && !isSystemColumn(c)))

const skippedCount = computed(() => props.columns.length - deletableColumns.value.length)

const onDelete = async () => {
  if (!deletableColumns.value.length) return

  // Fetch optimistic-concurrency hash then delete all columns in one call.
  const columnsHash = (
    await $api.internal.getOperation(meta!.value!.fk_workspace_id!, meta!.value!.base_id!, {
      operation: 'columnsHash',
      tableId: meta!.value!.id!,
    })
  ).hash

  const result = (await $api.internal.postOperation(
    meta!.value!.fk_workspace_id!,
    meta!.value!.base_id!,
    { operation: 'columnsBulk', tableId: meta!.value!.id! },
    {
      hash: columnsHash,
      ops: deletableColumns.value.map((col) => ({ op: 'delete', column: { id: col.id! } })),
    },
  )) as { failedOps?: Array<{ column: { id: string }; error: string }> }

  const failedIds = new Set((result?.failedOps ?? []).map((f) => f.column.id))
  const deletedIds = new Set(deletableColumns.value.map((c) => c.id!).filter((id) => !failedIds.has(id)))

  // Refresh meta once after all deletions.
  await getMeta(meta?.value?.base_id as string, meta?.value?.id as string, true)

  // For any deleted LTAR, refresh the related table meta + tables list if it
  // owned a junction.
  for (const col of deletableColumns.value) {
    if (!deletedIds.has(col.id as string)) continue
    if (!(isLinksOrLTAR(col) && col?.colOptions)) continue
    const relatedBaseId = (col.colOptions as LinkToAnotherRecordType).fk_related_base_id || meta?.value?.base_id
    await getMeta(relatedBaseId as string, (col.colOptions as LinkToAnotherRecordType).fk_related_model_id!, true)
    const colType = (col.colOptions as LinkToAnotherRecordType).type
    const hasJunctionTable = isLinkV2(col) || colType === RelationTypes.MANY_TO_MANY
    if (includeM2M.value && hasJunctionTable) {
      loadTables()
    }
  }

  if (deletedIds.size) {
    viewsStore.updateViewCoverImageColumnId({
      metaId: meta.value?.id as string,
      baseId: meta.value?.base_id as string,
      columnIds: deletedIds,
    })
    eventBus.emit(SmartsheetStoreEvents.FIELD_UPDATE)
    $e('a:column:delete:multi', { count: deletedIds.size })
  }

  if (failedIds.size) {
    const failedTitles = deletableColumns.value.filter((c) => failedIds.has(c.id!)).map((c) => c.title ?? c.id ?? '')
    message.error(t('msg.error.someFieldsCouldNotBeDeleted', { fields: failedTitles.join(', ') }))
  }

  visible.value = false
  props.onDeleted?.()
}
</script>

<template>
  <GeneralDeleteModal
    v-model:visible="visible"
    :entity-name="t('objects.fields')"
    :on-delete="onDelete"
    :show-default-delete-msg="false"
    :disable-delete-btn="!deletableColumns.length"
  >
    <template #entity-preview>
      <div class="mb-3 text-nc-content-gray">
        {{ t('msg.areYouSureDeleteNFields', { count: deletableColumns.length }) }}
      </div>

      <div class="flex flex-col gap-1 max-h-60 overflow-y-auto nc-scrollbar-thin">
        <div
          v-for="col in deletableColumns"
          :key="col.id"
          class="flex flex-row items-center py-1.5 px-3 bg-nc-bg-gray-extralight rounded-lg text-nc-content-gray-subtle2"
        >
          <SmartsheetHeaderIcon :column="col" class="nc-view-icon" />

          <div
            class="capitalize text-ellipsis overflow-hidden select-none w-full pl-1.5"
            :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
          >
            {{ col.title }}
          </div>
        </div>
      </div>

      <div v-if="skippedCount > 0" class="mt-2 text-caption text-nc-content-gray-subtle">
        {{ t('msg.fieldsCannotBeDeletedSkipped', { count: skippedCount }) }}
      </div>
    </template>
  </GeneralDeleteModal>
</template>
