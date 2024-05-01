<script lang="ts" setup>
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { RelationTypes, isLinksOrLTAR, isSystemColumn } from 'nocodb-sdk'
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

const emit = defineEmits(['update:modelValue', 'addNewRecord', 'attachLinkedRecord'])

const vModel = useVModel(props, 'modelValue', emit)

const { isMobileMode } = useGlobal()

const injectedColumn = inject(ColumnInj)

const { isSharedBase } = storeToRefs(useBase())

const filterQueryRef = ref<HTMLInputElement>()

const { t } = useI18n()

const { $e } = useNuxtApp()

const {
  childrenExcludedList,
  isChildrenExcludedListLinked,
  childrenExcludedOffsetCount,
  childrenListOffsetCount,
  isChildrenExcludedListLoading,
  isChildrenExcludedLoading,
  childrenListCount,
  loadChildrenExcludedList,
  loadChildrenList,
  childrenExcludedListPagination,
  relatedTableDisplayValueProp,
  displayValueTypeAndFormatProp,
  link,
  relatedTableMeta,
  meta,
  unlink,
  row,
  headerDisplayValue,
  resetChildrenExcludedOffsetCount,
} = useLTARStoreOrThrow()

const { addLTARRef, isNew, removeLTARRef, state: rowState } = useSmartsheetRowStoreOrThrow()

const isPublic = inject(IsPublicInj, ref(false))

const isExpandedFormCloseAfterSave = ref(false)

isChildrenExcludedLoading.value = true

const isForm = inject(IsFormInj, ref(false))

const saveRow = inject(SaveRowInj, () => {})

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
    if (!nextVal) {
      resetChildrenExcludedOffsetCount()
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
    // Links as for the case of 'mm' we need the 'Links' column
    if (!isLinksOrLTAR(col)) return false
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
    isExpandedFormCloseAfterSave.value = false
    if (!isForm.value) {
      loadChildrenList()
    }
    loadChildrenExcludedList(rowState.value)
  }
  childrenExcludedOffsetCount.value = 0
  childrenListOffsetCount.value = 0
})

watch(filterQueryRef, () => {
  filterQueryRef.value?.focus()
})

const onClick = (refRow: any, id: string) => {
  if (isSharedBase.value) return
  if (isChildrenExcludedListLinked.value[Number.parseInt(id)]) {
    unlinkRow(refRow, Number.parseInt(id))
  } else {
    linkRow(refRow, Number.parseInt(id))
  }
}

const addNewRecord = () => {
  expandedFormRow.value = {}
  expandedFormDlg.value = true
  isExpandedFormCloseAfterSave.value = true
}

const onCreatedRecord = (record: any) => {
  const msgVNode = h(
    'div',
    {
      class: 'ml-1 inline-flex flex-col gap-1 items-start',
    },
    [
      h(
        'span',
        {
          class: 'font-semibold',
        },
        t('activity.recordCreatedLinked'),
      ),
      h(
        'span',
        {
          class: 'text-gray-500',
        },
        t('activity.gotSavedLinkedSuccessfully', {
          tableName: relatedTableMeta.value?.title,
          recordTitle: record[relatedTableDisplayValueProp.value],
        }),
      ),
    ],
  )

  message.success(msgVNode)
}

const linkedShortcuts = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    vModel.value = false
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    try {
      e.target?.nextElementSibling?.focus()
    } catch (e) {}
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    try {
      e.target?.previousElementSibling?.focus()
    } catch (e) {}
  } else if (!expandedFormDlg.value && e.key !== 'Tab' && e.key !== 'Shift' && e.key !== 'Enter' && e.key !== ' ') {
    try {
      filterQueryRef.value?.focus()
    } catch (e) {}
  }
}

const childrenExcludedListRef = ref<HTMLDivElement>()

watch(childrenExcludedListPagination, () => {
  childrenExcludedListRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
})

onMounted(() => {
  window.addEventListener('keydown', linkedShortcuts)
})

onUnmounted(() => {
  resetChildrenExcludedOffsetCount()
  childrenExcludedListPagination.query = ''
  window.removeEventListener('keydown', linkedShortcuts)
})

const onFilterChange = () => {
  childrenExcludedListPagination.page = 1
  resetChildrenExcludedOffsetCount()
}
</script>

<template>
  <div class="nc-modal-link-record h-full w-full overflow-hidden" :class="{ active: vModel }">
    <div class="flex flex-col h-full">
      <div class="nc-dropdown-link-record-header bg-gray-100 py-2 rounded-t-md">
        <div class="nc-dropdown-link-record-search-wrapper flex items-center px-3 py-1 rounded-md w-full">
          <MdiMagnify class="nc-search-icon w-5 h-5" />
          <a-input
            ref="filterQueryRef"
            v-model:value="childrenExcludedListPagination.query"
            :bordered="false"
            placeholder="Search records to link..."
            class="w-full nc-excluded-search min-h-4"
            size="small"
            @change="onFilterChange"
            @keydown.capture.stop="
              (e) => {
                if (e.key === 'Escape') {
                  filterQueryRef?.blur()
                }
              }
            "
          >
          </a-input>
        </div>
      </div>
      <div class="flex-1 overflow-auto nc-scrollbar-thin">
        <template v-if="childrenExcludedList?.pageInfo?.totalRows">
          <div ref="childrenExcludedListRef" class="overflow-scroll nc-scrollbar-md pr-1 cursor-pointer flex flex-col flex-grow">
            <template v-if="isChildrenExcludedLoading">
              <div
                v-for="(_x, i) in Array.from({ length: 10 })"
                :key="i"
                class="!border-2 flex flex-row gap-2 mb-2 transition-all !rounded-xl relative !border-gray-200 hover:bg-gray-50"
              >
                <a-skeleton-image class="h-24 w-24 !rounded-xl" />
                <div class="flex flex-col m-[.5rem] gap-2 flex-grow justify-center">
                  <a-skeleton-input active class="!xs:w-30 !w-48 !rounded-xl" size="small" />
                  <div class="flex flex-row gap-6 w-10/12">
                    <div class="flex flex-col gap-0.5">
                      <a-skeleton-input active class="!h-4 !w-12" size="small" />
                      <a-skeleton-input active class="!xs:hidden !h-4 !w-24" size="small" />
                    </div>
                    <div class="flex flex-col gap-0.5">
                      <a-skeleton-input active class="!h-4 !w-12" size="small" />
                      <a-skeleton-input active class="!xs:hidden !h-4 !w-24" size="small" />
                    </div>
                    <div class="flex flex-col gap-0.5">
                      <a-skeleton-input active class="!h-4 !w-12" size="small" />
                      <a-skeleton-input active class="!xs:hidden !h-4 !w-24" size="small" />
                    </div>
                    <div class="flex flex-col gap-0.5">
                      <a-skeleton-input active class="!h-4 !w-12" size="small" />
                      <a-skeleton-input active class="!xs:hidden !h-4 !w-24" size="small" />
                    </div>
                  </div>
                </div>
              </div>
            </template>
            <template v-else>
              <LazyVirtualCellComponentsListItem
                v-for="(refRow, id) in childrenExcludedList?.list ?? []"
                :key="id"
                :attachment="attachmentCol"
                :display-value-type-and-format-prop="displayValueTypeAndFormatProp"
                :fields="fields"
                :is-linked="isChildrenExcludedListLinked[Number.parseInt(id)]"
                :is-loading="isChildrenExcludedListLoading[Number.parseInt(id)]"
                :related-table-display-value-prop="relatedTableDisplayValueProp"
                :row="refRow"
                data-testid="nc-excluded-list-item"
                @click="() => onClick(refRow, id)"
                @expand="
                  () => {
                    expandedFormRow = refRow
                    expandedFormDlg = true
                  }
                "
                @keydown.space.prevent="() => onClick(refRow, id)"
                @keydown.enter.prevent="() => onClick(refRow, id)"
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
            :total="+childrenExcludedList?.pageInfo?.totalRows"
            entity-name="links-excluded-list"
          />
        </div>
      </div>
      <div class="bg-gray-100 p-3 rounded-b-md flex items-center justify-between">
        <NcButton size="small" class="!text-gray-800 hover:!text-gray-600" type="link" @click="emit('attachLinkedRecord')">
          <div class="flex items-center gap-1"><GeneralIcon icon="ncArrowLeft" class="h-4 w-4" /> Linked Records</div>
        </NcButton>
        <div class="!xs:hidden flex items-center justify-center flex-1">
          <NcPagination
            v-if="childrenExcludedList?.pageInfo"
            v-model:current="childrenExcludedListPagination.page"
            v-model:page-size="childrenExcludedListPagination.size"
            :total="+childrenExcludedList?.pageInfo?.totalRows"
            entity-name="links-excluded-list"
            mode="simple"
          />
        </div>

        <div class="flex">
          <NcButton v-if="!isPublic" v-e="['c:row-expand:open']" size="small" class="" type="secondary" @click="addNewRecord">
            <div class="flex items-center gap-1"><MdiPlus v-if="!isMobileMode" /> {{ $t('activity.newRecord') }}</div>
          </NcButton>
        </div>
      </div>
    </div>
    <Suspense>
      <LazySmartsheetExpandedForm
        v-if="expandedFormDlg"
        v-model="expandedFormDlg"
        :close-after-save="isExpandedFormCloseAfterSave"
        :meta="relatedTableMeta"
        :new-record-header="
          isExpandedFormCloseAfterSave
            ? $t('activity.tableNameCreateNewRecord', {
                tableName: relatedTableMeta?.title,
              })
            : undefined
        "
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
        @created-record="onCreatedRecord"
      />
    </Suspense>
  </div>
</template>

<style lang="scss">
.nc-dropdown-link-record-search-wrapper {
  .nc-search-icon {
    @apply text-gray-500;
  }

  &:focus-within {
    .nc-search-icon {
      @apply text-gray-800;
    }
  }
}
</style>
