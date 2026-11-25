<script setup lang="ts">
import {
  type ColumnType,
  SeparatorType,
  type TableType,
  UITypes,
  getAvailableRollupForColumn,
  rollupAllFunctions,
} from 'nocodb-sdk'
import Draggable from 'vuedraggable'
import { generateUniqueColumnName } from '~/helpers/parsers/parserHelpers'

interface Props {
  value?: boolean
  type?: UITypes.Lookup | UITypes.Rollup
}

const props = withDefaults(defineProps<Props>(), {
  type: UITypes.Lookup,
})

const { $api } = useNuxtApp()

const { getMeta, getMetaByKey } = useMetas()

const { t } = useI18n()

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const menuColumn = inject(ColumnInj)

const canvasColumn = inject(CanvasColumnInj, ref())

const reloadDataHook = inject(ReloadViewDataHookInj, undefined)

const column = computed(() => menuColumn?.value || canvasColumn?.value)

const value = useVModel(props, 'value')

const isLoading = ref(false)

const searchField = ref('')

const isDragging = ref<boolean>(false)

const filteredColumns = ref<
  {
    column: ColumnType
    show: boolean
    id: string
  }[]
>([])

const selectedFields = ref<Record<string, boolean>>({})

// All field ids in the order the user dragged them; empty until the first drag, kept across searches
const arrangedIds = ref<string[]>([])

const isLoadingModel = ref(false)

const fkRelatedModelId = computed(() => (column.value.colOptions as any)?.fk_related_model_id)

// For cross-base links, use fk_related_base_id, otherwise use current base_id
const relatedBaseId = computed(() => (column.value.colOptions as any)?.fk_related_base_id || meta.value?.base_id)

const relatedModel = ref<TableType | null>()

interface ViewColumn {
  fk_column_id?: string
  order?: number
  show?: boolean | number
}

// Columns of the view whose field order the list follows; unset → related table's default view
const orderViewColumns = ref<ViewColumn[]>()

const isSelfLink = computed(() => fkRelatedModelId.value === meta.value?.id && relatedBaseId.value === meta.value?.base_id)

// Self link → the view on screen; link limited to a view → that view
const orderViewId = computed<string | undefined>(() =>
  isSelfLink.value ? activeView.value?.id : (column.value.colOptions as any)?.fk_target_view_id || undefined,
)

const fieldPositionById = computed(() => {
  const map: Record<string, { order: number; hidden: boolean }> = {}

  if (orderViewColumns.value) {
    for (const vc of orderViewColumns.value) {
      if (vc.fk_column_id) map[vc.fk_column_id] = { order: vc.order ?? Infinity, hidden: !vc.show }
    }
    return map
  }

  for (const c of getMetaByKey(relatedBaseId.value, relatedModel.value?.id)?.columns || []) {
    const colMeta = parseProp(c.meta)
    map[c.id!] = {
      order: colMeta.defaultViewColOrder ?? Infinity,
      hidden: colMeta.defaultViewColVisibility === false,
    }
  }
  return map
})

const clearAll = () => {
  Object.keys(selectedFields.value).forEach((k) => (selectedFields.value[k] = false))
}

const selectAll = () => {
  filteredColumns.value.forEach((c) => (selectedFields.value[c.id] = true))
}

const getLookupColPayload = (selectedColumn: ColumnType) => {
  return {
    fk_lookup_column_id: selectedColumn.id,
    lookupTableTitle: relatedModel.value?.title,
    lookupColumnTitle: selectedColumn?.title || selectedColumn?.column_name,
    title: `${selectedColumn?.title} from ${relatedModel.value?.title}`,
    column_name: `${selectedColumn?.title} from (${relatedModel.value?.title})`,
  }
}

const availableRollupPerColumn = computed(() => {
  const relatedTableColumns: ColumnType[] = getMetaByKey(relatedBaseId.value, relatedModel.value?.id)?.columns || []

  return relatedTableColumns.reduce((acc, curr) => {
    if (!curr?.id) return acc

    acc[curr.id] = rollupAllFunctions
      .map((obj) => {
        return {
          ...obj,
          text: t(obj.text),
        }
      })
      .filter((func) => getAvailableRollupForColumn(curr).includes(func.value))

    return acc
  }, {} as Record<string, { text: string; value: string }[]>)
})

const getRollupColPayload = (selectedColumn: ColumnType) => {
  const aggFunctionsList = availableRollupPerColumn.value[selectedColumn?.id as string] || []

  return {
    fk_rollup_column_id: selectedColumn.id,
    rollupTableTitle: relatedModel.value?.title,
    rollupColumnTitle: selectedColumn?.title || selectedColumn?.column_name,
    meta: {
      precision: 0,
      separator: SeparatorType.NonePeriod,
    },

    ...(aggFunctionsList.length
      ? {
          rollup_function: aggFunctionsList[0]!.value,
          rollup_function_name: aggFunctionsList[0]!.text,
        }
      : {}),
  }
}

// Evenly spaced view orders that place `count` new fields right of the link field
const getNewColumnOrders = async (count: number): Promise<number[] | undefined> => {
  if (!activeView.value?.id || !count) return

  try {
    const viewColumns = (await fetchViewColumns(meta.value!.base_id!, activeView.value.id)).sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    )

    const linkIndex = viewColumns.findIndex((c) => c.fk_column_id === column.value?.id)
    if (linkIndex === -1) return

    const lower = viewColumns[linkIndex]!.order ?? 0
    const next = viewColumns[linkIndex + 1]
    const upper = next ? next.order ?? 0 : lower + count + 1
    // Neighbours share an order (legacy data): no gap to place into, append instead
    if (upper <= lower) return

    return Array.from({ length: count }, (_, i) => lower + ((upper - lower) * (i + 1)) / (count + 1))
  } catch (e) {
    // Fall back to appending at the end
    console.error(e)
  }
}

async function fetchViewColumns(baseId: string, viewId: string): Promise<ViewColumn[]> {
  return (
    await $api.internal.getOperation(meta.value!.fk_workspace_id!, baseId, {
      operation: 'viewColumnList',
      viewId,
    })
  ).list
}

// Visible fields in view order, then hidden ones
function compareFieldPosition(a: ColumnType, b: ColumnType) {
  const pa = fieldPositionById.value[a.id!] ?? { order: Infinity, hidden: false }
  const pb = fieldPositionById.value[b.id!] ?? { order: Infinity, hidden: false }
  if (pa.hidden !== pb.hidden) return pa.hidden ? 1 : -1
  return pa.order === pb.order ? 0 : pa.order - pb.order
}

// All field ids in list order, including ones a search hides
function listOrderIds() {
  if (arrangedIds.value.length) return arrangedIds.value
  return [...(getMetaByKey(relatedBaseId.value, relatedModel.value?.id)?.columns || [])]
    .sort(compareFieldPosition)
    .map((c) => c.id!)
}

function listRank(id: string, ids: string[]) {
  const i = ids.indexOf(id)
  return i === -1 ? ids.length : i
}

// Draggable sees only the searched subset: place the moved field next to its new neighbour in the full order
function onListChange({ moved }: { moved?: { element: { id: string }; newIndex: number } }) {
  if (!moved) return
  const ids = listOrderIds().filter((id) => id !== moved.element.id)
  const nextId = filteredColumns.value[moved.newIndex + 1]?.id
  const prevId = filteredColumns.value[moved.newIndex - 1]?.id
  const at = nextId ? ids.indexOf(nextId) : prevId ? ids.indexOf(prevId) + 1 : ids.length
  ids.splice(at === -1 ? ids.length : at, 0, moved.element.id)
  arrangedIds.value = ids
}

const createLookupsOrRollup = async () => {
  try {
    isLoading.value = true

    const bulkOpsCols: {
      op: 'add'
      column: ColumnType
    }[] = [] as any

    const currIndex = meta.value?.columns?.length ?? 0

    // Keep the order the user arranged in the list, including fields a search hides
    const orderIds = listOrderIds()
    const selectedIds = Object.entries(selectedFields.value)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .sort((a, b) => listRank(a, orderIds) - listRank(b, orderIds))

    const columnOrders = await getNewColumnOrders(selectedIds.length)

    for (const [i, k] of selectedIds.entries()) {
      const selectedColumn = getMetaByKey(relatedBaseId.value, relatedModel.value?.id)?.columns.find((c) => c.id === k)
      const tempCol = {
        uidt: props.type,
        fk_relation_column_id: column.value.id,
        table_name: meta.value?.table_name,
        view_id: activeView.value?.id,
        order: currIndex + i,
        column_order: {
          order: columnOrders?.[i] ?? currIndex + i,
          view_id: activeView.value?.id,
        },
        ...(props.type === UITypes.Lookup ? getLookupColPayload(selectedColumn) : getRollupColPayload(selectedColumn)),
      }

      const newColName = generateUniqueColumnName({
        formState: tempCol,
        metaColumns: relatedModel.value?.columns,
        tableExplorerColumns: meta.value?.columns,
      })

      bulkOpsCols.push({
        op: 'add',
        column: {
          ...tempCol,
          title: newColName,
          column_name: newColName,
        },
      })
    }

    await $api.internal.postOperation(
      meta.value!.fk_workspace_id!,
      meta.value!.base_id!,
      { operation: 'columnsBulk', tableId: meta.value?.id as string },
      {
        hash: meta.value?.columnsHash,
        ops: bulkOpsCols,
      },
    )

    await getMeta({ baseId: meta?.value?.base_id as string, tableIdOrTitle: meta?.value?.id as string, force: true })

    reloadDataHook?.trigger({ fieldAdd: true, inPlace: true })

    value.value = false
  } catch (e) {
    console.error(e)
    message.error(t('msg.error.lookupColumnCreateFailed'))
  } finally {
    isLoading.value = false
  }
}

watch(
  [relatedModel, searchField, value, () => props.type, availableRollupPerColumn, fieldPositionById],
  async () => {
    if (relatedModel.value) {
      const columns = getMetaByKey(relatedBaseId.value, relatedModel.value.id)?.columns || []
      filteredColumns.value = columns
        .filter((c: any) => {
          if (props.type === UITypes.Lookup) {
            return (
              getValidLookupColumn({
                column: c,
              }) && searchCompare([c?.title], searchField.value)
            )
          }

          return (
            getValidRollupColumn(c) &&
            availableRollupPerColumn.value[c.id]?.length &&
            searchCompare([c?.title], searchField.value)
          )
        })
        .sort((a, b) =>
          arrangedIds.value.length
            ? listRank(a.id!, arrangedIds.value) - listRank(b.id!, arrangedIds.value)
            : compareFieldPosition(a, b),
        )
    }
  },
  {
    immediate: true,
  },
)

// Load on every open: this component mounts with the column menu, not the dialog
watch(
  value,
  async (open) => {
    if (!open) return

    arrangedIds.value = []
    isLoadingModel.value = true
    try {
      const [model, viewColumns] = await Promise.all([
        getMeta({ baseId: relatedBaseId.value as string, tableIdOrTitle: fkRelatedModelId.value }),
        orderViewId.value
          ? fetchViewColumns(relatedBaseId.value as string, orderViewId.value).catch((e) => {
              // Fall back to the default view order
              console.error(e)
              return undefined
            })
          : undefined,
      ])
      orderViewColumns.value = viewColumns
      relatedModel.value = model
    } finally {
      isLoadingModel.value = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <NcModal v-model:visible="value" size="small">
    <div class="flex flex-col gap-3">
      <div>
        <h1 class="text-base text-nc-content-gray font-semibold flex items-center gap-2">
          <SmartsheetHeaderVirtualCellIcon
            :column-meta="{
              uidt: type,
              fk_model_id: column?.fk_model_id,
              colOptions: {
                fk_relation_column_id: column?.id,
              },
            }"
            class="h-5 w-5 !mx-0"
          />

          {{ $t(type === UITypes.Lookup ? 'general.addLookupField' : 'general.addRollupField') }}
        </h1>
        <div class="text-nc-content-gray-muted text-[13px] leading-5">
          {{ type === UITypes.Lookup ? $t('labels.addNewLookupHelperText1') : $t('labels.addNewRollupHelperText1') }}

          <span class="font-semibold">
            {{ relatedModel?.title ?? relatedModel?.table_name }}
          </span>
          {{ type === UITypes.Lookup ? $t('labels.addNewLookupHelperText2') : $t('labels.addNewRollupHelperText2') }}
        </div>
      </div>

      <div class="flex w-full gap-2 justify-between items-center">
        <a-input v-model:value="searchField" class="w-full h-8 flex-1" size="small" :placeholder="$t('placeholder.searchFields')">
          <template #prefix>
            <component :is="iconMap.search" class="w-4 text-nc-content-gray-muted h-4" />
          </template>
        </a-input>
        <div class="flex items-center gap-2">
          <NcButton size="small" type="text" class="!text-xs" @click="clearAll"> {{ $t('labels.clearAll') }} </NcButton>
          <NcButton size="small" type="text" class="!text-xs" @click="selectAll"> {{ $t('general.addAll') }} </NcButton>
        </div>
      </div>

      <div
        :class="{
          'flex items-center justify-center': isLoadingModel,
        }"
        class="border-1 rounded-md h-[300px] nc-scrollbar-md border-nc-border-gray-medium"
      >
        <Draggable
          v-if="!isLoadingModel"
          v-bind="getDraggableAutoScrollOptions({ scrollSensitivity: 50 })"
          v-model="filteredColumns"
          item-key="id"
          ghost-class="nc-lookup-menu-items-ghost"
          @start="isDragging = true"
          @end="isDragging = false"
          @change="onListChange"
        >
          <template #item="{ element: field }">
            <div
              :key="field.id"
              :data-testid="`nc-lookup-add-menu-${field.title}`"
              class="px-3 py-1 flex flex-row items-center rounded-md"
              :class="{
                'hover:bg-nc-bg-gray-light': !isDragging,
              }"
              @click.stop="selectedFields[field.id] = !selectedFields[field.id]"
            >
              <component :is="iconMap.drag" class="cursor-move !h-3.75 text-nc-content-gray-subtle2 mr-1" />
              <div class="flex flex-row items-center w-full cursor-pointer truncate ml-1 py-[5px] pr-2">
                <SmartsheetHeaderIcon :column="field" class="!w-3.5 !h-3.5" color="text-nc-content-gray-muted" />
                <NcTooltip class="flex-1 pl-1 pr-2 truncate" show-on-truncate-only>
                  <template #title>
                    {{ field.title }}
                  </template>
                  <template #default>{{ field.title }}</template>
                </NcTooltip>

                <NcCheckbox v-model:checked="selectedFields[field.id]" size="default" />
              </div>

              <div class="flex-1" />
            </div>
          </template>
        </Draggable>

        <div v-else>
          <GeneralLoader size="xlarge" />
        </div>
      </div>

      <div class="flex w-full gap-2 justify-end">
        <NcButton type="secondary" size="small" @click="value = false">
          {{ $t('general.cancel') }}
        </NcButton>

        <NcButton
          :loading="isLoading"
          :disabled="!Object.values(selectedFields).filter(Boolean).length"
          size="small"
          @click="createLookupsOrRollup"
        >
          {{
            $t(type === UITypes.Lookup ? 'general.addLookupField' : 'general.addRollupField', {
              count: Object.values(selectedFields).filter(Boolean).length || '',
            })
          }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>

<style scoped lang="scss">
.ant-input::placeholder {
  @apply text-nc-content-gray-muted;
}

.ant-input:placeholder-shown {
  @apply text-nc-content-gray-muted !text-md;
}

.ant-input-affix-wrapper {
  @apply px-4 rounded-lg py-2 w-84 border-1 focus:border-nc-border-brand border-nc-border-gray-medium !ring-0;
}
</style>
