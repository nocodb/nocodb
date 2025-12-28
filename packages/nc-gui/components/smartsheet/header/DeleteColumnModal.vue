<script lang="ts" setup>
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { DependencyTableType, RelationTypes, isLinksOrLTAR } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
  onDeleteColumn?: () => void
}>()

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)

const { $api, $e } = useNuxtApp()

const menuColumn = inject(ColumnInj)

const canvasColumn = inject(CanvasColumnInj, ref())

const column = computed<ColumnType>(() => {
  return menuColumn?.value || canvasColumn?.value
})

const { eventBus } = useSmartsheetStoreOrThrow()

const meta = inject(MetaInj, ref())

const { getMeta } = useMetas()

const { includeM2M } = useGlobal()

const { loadTables } = useBase()

const viewsStore = useViewsStore()

const isLoading = ref(false)

const { status, dependency, checkDependency } = useDependencies()

watch(
  () => props.visible,
  async (newVal) => {
    if (newVal && column.value?.id) {
      await checkDependency(DependencyTableType.Column, column.value.id)
    }
  },
  { immediate: true },
)

// disable for time being - internal discussion required
/*
const warningMsg = computed(() => {
  if (!column?.value) return []

  const columns = meta?.value?.columns.filter((c) => {
    if (isLinksOrLTAR(c) && c.colOptions) {
      return (
        (c.colOptions as LinkToAnotherRecordType).fk_parent_column_id === column.value?.id ||
        (c.colOptions as LinkToAnotherRecordType).fk_child_column_id === column.value?.id ||
        (c.colOptions as LinkToAnotherRecordType).fk_mm_child_column_id === column.value?.id ||
        (c.colOptions as LinkToAnotherRecordType).fk_mm_parent_column_id === column.value?.id
      )
    }

    return false
  })

  if (!columns.length) return null

  return `This column is used in following Link column${columns.length > 1 ? 's' : ''}: '${columns
    .map((c) => c.title)
    .join("', '")}'. Deleting this column will also delete the related Link column${columns.length > 1 ? 's' : ''}.`
}) */

const onDelete = async () => {
  if (!column.value) return

  isLoading.value = true

  try {
    await $api.internal.postOperation(
      meta!.value!.fk_workspace_id!,
      meta!.value!.base_id!,
      {
        operation: 'columnDelete',
        columnId: column.value.id as string,
      },
      {},
    )

    await getMeta(meta?.value?.base_id as string, meta?.value?.id as string, true)

    /** force-reload related table meta if deleted column is a LTAR and not linked to same table */
    if (isLinksOrLTAR(column.value) && column.value?.colOptions) {
      const relatedBaseId = (column.value.colOptions as LinkToAnotherRecordType).fk_related_base_id || meta?.value?.base_id
      await getMeta(relatedBaseId as string, (column.value.colOptions as LinkToAnotherRecordType).fk_related_model_id!, true)

      // reload tables if deleted column is mm and include m2m is true
      if (includeM2M.value && (column.value.colOptions as LinkToAnotherRecordType).type === RelationTypes.MANY_TO_MANY) {
        loadTables()
      }
    }

    // Update views if column is used as cover image

    viewsStore.updateViewCoverImageColumnId({
      metaId: meta.value?.id as string,
      baseId: meta.value?.base_id,
      columnIds: new Set([column.value.id as string]),
    })
    eventBus.emit(SmartsheetStoreEvents.FIELD_UPDATE)

    $e('a:column:delete')
    visible.value = false

    props.onDeleteColumn?.()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <GeneralDeleteModal
    v-model:visible="visible"
    :entity-name="$t('objects.column')"
    :on-delete="onDelete"
    :disable-delete-btn="status === 'loading'"
  >
    <template #entity-preview>
      <div
        v-if="column"
        class="flex flex-row items-center py-2 px-3 bg-nc-bg-gray-extralight rounded-lg text-nc-content-gray-subtle2 mb-4"
      >
        <SmartsheetHeaderIcon :column="column" class="nc-view-icon" />

        <div
          class="capitalize text-ellipsis overflow-hidden select-none w-full pl-1.5"
          :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
        >
          {{ column.title }}
        </div>
      </div>
      <div class="mt-4">
        <NcDependencyList
          :status="status"
          :has-breaking-changes="dependency.hasBreakingChanges"
          :entities="dependency.entities"
          action="delete"
          entity-type="column"
        />
      </div>
    </template>

    <!-- disable for time being - internal discussion required -->
    <!-- <template v-if="warningMsg" #warning>{{ warningMsg }}</template> -->
  </GeneralDeleteModal>
</template>
