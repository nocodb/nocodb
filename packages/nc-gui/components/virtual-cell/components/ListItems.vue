<script lang="ts" setup>
import { RelationTypes, UITypes, isLinksOrLTAR, isSystemColumn } from 'nocodb-sdk'
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import InboxIcon from '~icons/nc-icons/inbox'
import {
  ColumnInj,
  IsPublicInj,
  SaveRowInj,
  computed,
  inject,
  ref,
  useLTARStoreOrThrow,
  useSmartsheetRowStoreOrThrow,
  useVModel,
} from '#imports'

const props = defineProps<{ modelValue: boolean; column: any }>()

const emit = defineEmits(['update:modelValue', 'addNewRecord'])

const vModel = useVModel(props, 'modelValue', emit)

const injectedColumn = inject(ColumnInj)

const filterQueryRef = ref()

const {
  childrenExcludedList,
  isChildrenExcludedListLinked,
  isChildrenExcludedListLoading,
  displayValueProp,
  childrenListCount,
  loadChildrenExcludedList,
  loadChildrenList,
  childrenExcludedListPagination,
  relatedTableDisplayValueProp,
  link,
  relatedTableMeta,
  meta,
  unlink,
  row,
} = useLTARStoreOrThrow()

const { addLTARRef, isNew } = useSmartsheetRowStoreOrThrow()

const isPublic = inject(IsPublicInj, ref(false))

const saveRow = inject(SaveRowInj, () => {})

const selectedRowIndex = ref(0)

const isFocused = ref(false)

const linkRow = async (row: Record<string, any>, id: number) => {
  if (isNew.value) {
    addLTARRef(row, injectedColumn?.value as ColumnType)
    saveRow!()
  } else {
    await link(row, {}, false, id)
  }
}

/** reload list on modal open */
watch(vModel, (nextVal, prevVal) => {
  if (nextVal && !prevVal) {
    /** reset query and limit */
    childrenExcludedListPagination.query = ''
    childrenExcludedListPagination.page = 1
    loadChildrenList()
    loadChildrenExcludedList()
    selectedRowIndex.value = 0
  }
})

const expandedFormDlg = ref(false)

const expandedFormRow = ref({})

/** populate initial state for a new row which is parent/child of current record */
const newRowState = computed(() => {
  if (isNew.value) return {}
  const colOpt = (injectedColumn?.value as ColumnType)?.colOptions as LinkToAnotherRecordType
  const colInRelatedTable: ColumnType | undefined = relatedTableMeta?.value?.columns?.find((col) => {
    if (col.uidt !== UITypes.LinkToAnotherRecord) return false
    const colOpt1 = col?.colOptions as LinkToAnotherRecordType
    if (colOpt1?.fk_related_model_id !== meta.value.id) return false

    if (colOpt.type === RelationTypes.MANY_TO_MANY && colOpt1?.type === RelationTypes.MANY_TO_MANY) {
      return (
        colOpt.fk_parent_column_id === colOpt1.fk_child_column_id && colOpt.fk_child_column_id === colOpt1.fk_parent_column_id
      )
    } else {
      return (
        colOpt.fk_parent_column_id === colOpt1.fk_parent_column_id && colOpt.fk_child_column_id === colOpt1.fk_child_column_id
      )
    }
  })
  if (!colInRelatedTable) return {}
  const relatedTableColOpt = colInRelatedTable?.colOptions as LinkToAnotherRecordType
  if (!relatedTableColOpt) return {}

  if (relatedTableColOpt.type === RelationTypes.BELONGS_TO) {
    return {
      [colInRelatedTable.title as string]: row?.value?.row,
    }
  } else {
    return {
      [colInRelatedTable.title as string]: row?.value && [row.value.row],
    }
  }
})

const attachmentCol = computedInject(FieldsInj, (_fields) => {
  return (relatedTableMeta.value.columns ?? []).filter((col) => isAttachment(col))[0]
})

const fields = computedInject(FieldsInj, (_fields) => {
  return (relatedTableMeta.value.columns ?? [])
    .filter((col) => !isSystemColumn(col) && !isPrimary(col) && !isLinksOrLTAR(col) && !isAttachment(col))
    .slice(0, 4)
})

const relation = computed(() => {
  return injectedColumn!.value?.colOptions?.type
})

watch(expandedFormDlg, () => {
  loadChildrenExcludedList()
})
</script>

<template>
  <a-modal
    v-model:visible="vModel"
    :class="{ active: vModel }"
    :footer="null"
    :width="840"
    :closable="false"
    :body-style="{ 'padding': 0, 'margin': 0, 'min-height': '500px' }"
    wrap-class-name="nc-modal-link-record"
  >
    <LazyVirtualCellComponentsHeader
      :relation="relation"
      :linked-records="childrenListCount"
      :table-title="meta?.title"
      :related-table-title="relatedTableMeta?.title"
      :display-value="row.row[displayValueProp]"
    />
    <div class="m-4 bg-gray-50 border-gray-50 border-b-2"></div>
    <div class="flex mt-2 mb-2 items-center gap-2">
      <div
        class="flex items-center border-1 p-1 rounded-md w-full border-gray-200"
        :class="{ '!border-primary': childrenExcludedListPagination.query.length !== 0 || isFocused }"
      >
        <MdiMagnify class="w-5 h-5 ml-2" />
        <a-input
          ref="filterQueryRef"
          v-model:value="childrenExcludedListPagination.query"
          :placeholder="`Search in ${relatedTableMeta?.title}`"
          class="w-full !rounded-md nc-excluded-search"
          size="small"
          :bordered="false"
          @focus="isFocused = true"
          @blur="isFocused = false"
          @keydown.capture.stop
        >
        </a-input>
      </div>

      <div class="flex-1" />

      <!-- Add new record -->
      <NcButton
        v-if="!isPublic"
        type="ghost"
        size="xl"
        class="!text-brand-500"
        @click="
          () => {
            expandedFormRow = {}
            expandedFormDlg = true
          }
        "
      >
        <MdiPlus class="w-4 h-4" />
        New Record
      </NcButton>
    </div>

    <template v-if="childrenExcludedList?.pageInfo?.totalRows">
      <div class="pb-2 pt-1">
        <div class="h-[420px] overflow-scroll nc-scrollbar-md pr-1 cursor-pointer">
          <LazyVirtualCellComponentsListItem
            data-testid="nc-excluded-list-item"
            v-for="(refRow, id) in childrenExcludedList?.list ?? []"
            :key="id"
            :row="refRow"
            :fields="fields"
            :attachment="attachmentCol"
            :related-table-display-value-prop="relatedTableDisplayValueProp"
            :is-loading="isChildrenExcludedListLoading[Number.parseInt(id)]"
            :is-linked="isChildrenExcludedListLinked[Number.parseInt(id)]"
            @expand="
              () => {
                expandedFormRow = refRow
                expandedFormDlg = true
              }
            "
            @click="
              () => {
                if (isChildrenExcludedListLinked[Number.parseInt(id)]) unlink(refRow, {}, false, Number.parseInt(id))
                else linkRow(refRow, Number.parseInt(id))
              }
            "
          />
        </div>
      </div>
    </template>
    <div v-else class="py-2 h-[420px] flex flex-col items-center justify-center text-gray-500">
      <InboxIcon class="w-16 h-16 mx-auto" />
      <p>There are no records in table</p>
    </div>
    <div class="my-2 bg-gray-50 border-gray-50 border-b-2"></div>

    <div class="flex flex-row justify-between bg-white relative pt-1">
      <div class="flex items-center justify-center px-2 rounded-md text-brand-500 bg-brand-50">
        {{ relation === 'bt' ? (row.row[relatedTableMeta?.title] ? '1' : 0) : childrenListCount ?? 'No' }} records
        {{ childrenListCount !== 0 ? 'are' : '' }} linked
      </div>
      <div class="flex absolute items-center py-2 justify-center w-full">
        <a-pagination
          v-if="childrenExcludedList?.pageInfo"
          v-model:current="childrenExcludedListPagination.page"
          v-model:page-size="childrenExcludedListPagination.size"
          :total="+childrenExcludedList.pageInfo.totalRows"
          :show-size-changer="false"
          class="mt-2 mx-auto"
          size="small"
          hide-on-single-page
          show-less-items
        />
      </div>
      <NcButton class="nc-close-btn" @click="vModel = false"> Close </NcButton>
    </div>
    <Suspense>
      <LazySmartsheetExpandedForm
        v-if="expandedFormDlg"
        v-model="expandedFormDlg"
        :meta="relatedTableMeta"
        :row="{
          row: expandedFormRow,
          oldRow: {},
          rowMeta:
            Object.keys(expandedFormRow).length > 0
              ? {}
              : {
                  new: true,
                },
        }"
        :state="newRowState"
        use-meta-fields
      />
    </Suspense>
  </a-modal>
</template>
