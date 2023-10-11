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
  onKeyStroke,
  ref,
  useLTARStoreOrThrow,
  useSmartsheetRowStoreOrThrow,
  useVModel,
} from '#imports'

const props = defineProps<{ modelValue: boolean; column: any }>()

const emit = defineEmits(['update:modelValue', 'addNewRecord'])

const vModel = useVModel(props, 'modelValue', emit)

const { isMobileMode } = useGlobal()

const injectedColumn = inject(ColumnInj)

const { isSharedBase } = storeToRefs(useBase())

const filterQueryRef = ref()

const { $e } = useNuxtApp()

const {
  childrenExcludedList,
  isChildrenExcludedListLinked,
  isChildrenExcludedListLoading,
  displayValueProp,
  isChildrenExcludedLoading,
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

const { addLTARRef, isNew, removeLTARRef, state: rowState } = useSmartsheetRowStoreOrThrow()

const isPublic = inject(IsPublicInj, ref(false))

isChildrenExcludedLoading.value = true

const isForm = inject(IsFormInj, ref(false))

const saveRow = inject(SaveRowInj, () => {})

const isFocused = ref(false)

const linkRow = async (row: Record<string, any>, id: number) => {
  if (isNew.value) {
    addLTARRef(row, injectedColumn?.value as ColumnType)
    isChildrenExcludedListLinked.value[id] = true
    saveRow!()

    $e('a:links:link')
  } else {
    await link(row, {}, false, id)
  }
}

const unlinkRow = async (row: Record<string, any>, id: number) => {
  if (isNew.value) {
    removeLTARRef(row, injectedColumn?.value as ColumnType)
    isChildrenExcludedListLinked.value[id] = false
    saveRow!()
    $e('a:links:unlink')
  } else {
    await unlink(row, {}, false, id)
  }
}

/** reload list on modal open */
watch(
  vModel,
  (nextVal, prevVal) => {
    if (nextVal && !prevVal) {
      /** reset query and limit */
      childrenExcludedListPagination.query = ''
      childrenExcludedListPagination.page = 1
      if (!isForm.value) {
        loadChildrenList()
      }
      loadChildrenExcludedList(rowState.value)
    }
  },
  {
    immediate: true,
  },
)

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
    .slice(0, isMobileMode.value ? 1 : 4)
})

const relation = computed(() => {
  return injectedColumn!.value?.colOptions?.type
})

watch(expandedFormDlg, () => {
  if (!expandedFormDlg.value) {
    loadChildrenExcludedList(rowState.value)
  }
})

onKeyStroke('Escape', () => {
  vModel.value = false
})

const onClick = (refRow: any, id: string) => {
  if (isSharedBase.value) return
  if (isChildrenExcludedListLinked.value[Number.parseInt(id)]) {
    unlinkRow(refRow, Number.parseInt(id))
  } else {
    linkRow(refRow, Number.parseInt(id))
  }
}
</script>

<template>
  <NcModal
    v-model:visible="vModel"
    :class="{ active: vModel }"
    :footer="null"
    :width="isForm ? 600 : 800"
    :closable="false"
    :body-style="{ 'max-height': '640px', 'height': '85vh' }"
    wrap-class-name="nc-modal-link-record"
  >
    <LazyVirtualCellComponentsHeader
      v-if="!isForm"
      :relation="relation"
      :table-title="meta?.title"
      :related-table-title="relatedTableMeta?.title"
      :display-value="row.row[displayValueProp]"
    />
    <div class="!xs:hidden my-3 bg-gray-50 border-gray-50 border-b-2"></div>
    <div class="flex mt-2 mb-2 items-center gap-2">
      <div
        class="flex items-center border-1 p-1 rounded-md w-full border-gray-200"
        :class="{ '!border-primary': childrenExcludedListPagination.query.length !== 0 || isFocused }"
      >
        <MdiMagnify class="w-5 h-5 ml-2" />
        <a-input
          ref="filterQueryRef"
          v-model:value="childrenExcludedListPagination.query"
          :placeholder="`${$t('general.searchIn')} ${relatedTableMeta?.title}`"
          class="w-full !rounded-md nc-excluded-search xs:min-h-8"
          size="small"
          :bordered="false"
          @focus="isFocused = true"
          @blur="isFocused = false"
          @keydown.capture.stop
          @change="childrenExcludedListPagination.page = 1"
        >
        </a-input>
      </div>

      <div class="flex-1" />

      <!-- Add new record -->
      <NcButton
        v-if="!isPublic"
        v-e="['c:row-expand:open']"
        type="secondary"
        :size="isMobileMode ? 'medium' : 'small'"
        class="!text-brand-500"
        @click="
          () => {
            expandedFormRow = {}
            expandedFormDlg = true
          }
        "
      >
        <div class="flex items-center gap-1 px-4"><MdiPlus v-if="!isMobileMode" /> {{ $t('activity.newRecord') }}</div>
      </NcButton>
    </div>

    <template v-if="childrenExcludedList?.pageInfo?.totalRows">
      <div class="overflow-scroll nc-scrollbar-md pr-1 cursor-pointer flex flex-col flex-grow">
        <template v-if="isChildrenExcludedLoading">
          <div
            v-for="(x, i) in Array.from({ length: 10 })"
            :key="i"
            class="!border-2 flex flex-row gap-2 mb-2 transition-all !rounded-xl relative !border-gray-200 hover:bg-gray-50"
          >
            <a-skeleton-image class="h-24 w-24 !rounded-xl" />
            <div class="flex flex-col m-[.5rem] gap-2 flex-grow justify-center">
              <a-skeleton-input class="!xs:w-30 !w-48 !rounded-xl" active size="small" />
              <div class="flex flex-row gap-6 w-10/12">
                <div class="flex flex-col gap-0.5">
                  <a-skeleton-input class="!h-4 !w-12" active size="small" />
                  <a-skeleton-input class="!xs:hidden !h-4 !w-24" active size="small" />
                </div>
                <div class="flex flex-col gap-0.5">
                  <a-skeleton-input class="!h-4 !w-12" active size="small" />
                  <a-skeleton-input class="!xs:hidden !h-4 !w-24" active size="small" />
                </div>
                <div class="flex flex-col gap-0.5">
                  <a-skeleton-input class="!h-4 !w-12" active size="small" />
                  <a-skeleton-input class="!xs:hidden !h-4 !w-24" active size="small" />
                </div>
                <div class="flex flex-col gap-0.5">
                  <a-skeleton-input class="!h-4 !w-12" active size="small" />
                  <a-skeleton-input class="!xs:hidden !h-4 !w-24" active size="small" />
                </div>
              </div>
            </div>
          </div>
        </template>
        <template v-else>
          <LazyVirtualCellComponentsListItem
            v-for="(refRow, id) in childrenExcludedList?.list ?? []"
            :key="id"
            data-testid="nc-excluded-list-item"
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
            @click="() => onClick(refRow, id)"
          />
        </template>
      </div>
    </template>
    <div v-else class="my-auto py-2 flex flex-col gap-3 items-center justify-center text-gray-500">
      <InboxIcon class="w-16 h-16 mx-auto" />
      <p>
        {{ $t('msg.thereAreNoRecordsInTable') }}
        {{ relatedTableMeta?.title }}
      </p>
    </div>

    <div v-if="isMobileMode" class="flex flex-row justify-center items-center w-full my-2">
      <NcPagination
        v-if="childrenExcludedList?.pageInfo"
        v-model:current="childrenExcludedListPagination.page"
        v-model:page-size="childrenExcludedListPagination.size"
        :total="+childrenExcludedList.pageInfo.totalRows"
        entity-name="links-excluded-list"
      />
    </div>

    <div class="mb-2 bg-gray-50 border-gray-50 border-b-2"></div>

    <div class="flex flex-row justify-between items-center bg-white relative pt-1">
      <div v-if="!isForm" class="flex items-center justify-center px-2 rounded-md text-gray-500 bg-brand-50 h-9.5">
        {{ relation === 'bt' ? (row.row[relatedTableMeta?.title] ? '1' : 0) : childrenListCount ?? 'No' }}
        {{ !isMobileMode ? $t('objects.records') : '' }} {{ !isMobileMode && childrenListCount !== 0 ? 'are' : '' }}
        {{ $t('general.linked') }}
      </div>
      <div class="!xs:hidden flex absolute -mt-0.75 items-center py-2 justify-center w-full">
        <NcPagination
          v-if="childrenExcludedList?.pageInfo"
          v-model:current="childrenExcludedListPagination.page"
          v-model:page-size="childrenExcludedListPagination.size"
          :total="+childrenExcludedList.pageInfo.totalRows"
          entity-name="links-excluded-list"
          mode="simple"
        />
      </div>
      <NcButton class="nc-close-btn ml-auto" type="ghost" @click="vModel = false"> {{ $t('general.finish') }} </NcButton>
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
        :row-id="extractPkFromRow(expandedFormRow, relatedTableMeta.columns as ColumnType[])"
        :state="newRowState"
        use-meta-fields
      />
    </Suspense>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-link-record > .ant-modal > .ant-modal-content {
  @apply !p-0;
}
</style>
