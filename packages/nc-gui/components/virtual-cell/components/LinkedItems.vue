<script lang="ts" setup>
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { RelationTypes, isLinksOrLTAR, isSystemColumn } from 'nocodb-sdk'

interface Prop {
  modelValue?: boolean
  cellValue: any
  column: any
  items: number
}

const props = defineProps<Prop>()

const emit = defineEmits(['update:modelValue', 'attachRecord', 'escape'])

const vModel = useVModel(props, 'modelValue', emit)

const { isMobileMode } = useGlobal()

const { t } = useI18n()

const isForm = inject(IsFormInj, ref(false))

const isPublic = inject(IsPublicInj, ref(false))

const isExpandedFormCloseAfterSave = ref(false)

const isNewRecord = ref(false)

const injectedColumn = inject(ColumnInj, ref())

const readOnly = inject(ReadonlyInj, ref(false))

const filterQueryRef = ref<HTMLInputElement>()

const { isDataReadOnly } = useRoles()

const { isSharedBase } = storeToRefs(useBase())

const {
  childrenList,
  childrenListCount,
  loadChildrenList,
  childrenListPagination,
  childrenExcludedOffsetCount,
  childrenListOffsetCount,
  relatedTableDisplayValueProp,
  displayValueTypeAndFormatProp,
  unlink,
  isChildrenListLoading,
  isChildrenListLinked,
  isChildrenLoading,
  relatedTableMeta,
  link,
  meta,
  row,
  resetChildrenListOffsetCount,
} = useLTARStoreOrThrow()

const { isNew, state, removeLTARRef, addLTARRef } = useSmartsheetRowStoreOrThrow()

watch(
  [vModel, isForm],
  (nextVal) => {
    if ((nextVal[0] || nextVal[1]) && !isNew.value) {
      loadChildrenList(true)
    }

    // reset offset count when closing modal
    if (!nextVal[0]) {
      resetChildrenListOffsetCount()
    }
  },
  { immediate: true },
)

const unlinkRow = async (row: Record<string, any>, id: number) => {
  if (isNew.value) {
    await removeLTARRef(row, injectedColumn?.value as ColumnType)
  } else {
    await unlink(row, {}, false, id)
  }
}

const linkRow = async (row: Record<string, any>, id: number) => {
  if (isNew.value) {
    await addLTARRef(row, injectedColumn?.value as ColumnType)
  } else {
    await link(row, {}, false, id)
  }
}

const attachmentCol = computedInject(FieldsInj, (_fields) => {
  return (relatedTableMeta.value.columns ?? []).filter((col) => isAttachment(col))[0]
})

const fields = computedInject(FieldsInj, (_fields) => {
  return (relatedTableMeta.value.columns ?? [])
    .filter((col) => !isSystemColumn(col) && !isPrimary(col) && !isLinksOrLTAR(col) && !isAttachment(col))
    .sort((a, b) => {
      return (a.meta?.defaultViewColOrder ?? Infinity) - (b.meta?.defaultViewColOrder ?? Infinity)
    })
    .slice(0, isMobileMode.value ? 1 : 3)
})

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

const colTitle = computed(() => injectedColumn.value?.title || '')

const onClick = (row: Row) => {
  if (readOnly.value || isForm.value) return
  expandedFormRow.value = row
  expandedFormDlg.value = true
}
const addNewRecord = () => {
  expandedFormRow.value = {}
  expandedFormDlg.value = true
  isExpandedFormCloseAfterSave.value = true
  isNewRecord.value = true
}

const onCreatedRecord = async (record: any) => {
  if (!isNewRecord.value) return

  if (!isNew.value) {
    vModel.value = false
  } else {
    await addLTARRef(record, injectedColumn?.value as ColumnType)

    loadChildrenList(false, state.value)
  }

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

  isNewRecord.value = false
}

const relation = computed(() => {
  return injectedColumn!.value?.colOptions?.type
})

watch(
  () => props.cellValue,
  () => {
    if (isNew.value) loadChildrenList(false, state.value)
  },
  {
    immediate: true,
  },
)

watch(expandedFormDlg, () => {
  if (!expandedFormDlg.value) {
    isExpandedFormCloseAfterSave.value = false
  }
  childrenExcludedOffsetCount.value = 0
  childrenListOffsetCount.value = 0
})

/*
   to render same number of skeleton as the number of cards
   displayed
 */
const skeletonCount = computed(() => {
  if (props.items < 10 && childrenListPagination.page === 1) {
    return props.items
  }

  if (childrenListCount.value < 10 && childrenListPagination.page === 1) {
    return childrenListCount.value || 10
  }
  const totalRows = Math.ceil(childrenListCount.value / 10)

  if (totalRows === childrenListPagination.page) {
    return childrenListCount.value % 10
  }
  return 10
})

const totalItemsToShow = computed(() => {
  if (isForm.value || isNew.value) {
    return state.value?.[colTitle.value]?.length
  }

  if (isChildrenLoading.value) {
    return props.items
  }
  return childrenListCount.value
})

const isDataExist = computed<boolean>(() => {
  return childrenList.value?.pageInfo?.totalRows || (isNew.value && state.value?.[colTitle.value]?.length)
})

const linkOrUnLink = (rowRef: Record<string, string>, id: string) => {
  if (isSharedBase.value) return
  if (readOnly.value) return

  if (isPublic.value && !isForm.value) return
  if (isNew.value || isChildrenListLinked.value[parseInt(id)]) {
    unlinkRow(rowRef, parseInt(id))
  } else {
    linkRow(rowRef, parseInt(id))
  }
}

watch([filterQueryRef, isDataExist], () => {
  if (readOnly.value || isPublic.value ? isDataExist.value : true) {
    filterQueryRef.value?.focus()
  }
})

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

onMounted(() => {
  window.addEventListener('keydown', linkedShortcuts)

  setTimeout(() => {
    filterQueryRef.value?.focus()
  }, 100)
})

const childrenListRef = ref<HTMLDivElement>()

watch(childrenListPagination, () => {
  childrenListRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
})

onUnmounted(() => {
  resetChildrenListOffsetCount()
  childrenListPagination.query = ''
  window.removeEventListener('keydown', linkedShortcuts)
})

const onFilterChange = () => {
  childrenListPagination.page = 1
  // reset offset count when filter changes
  resetChildrenListOffsetCount()
}

const isSearchInputFocused = ref(false)

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (!childrenListPagination.query) emit('escape')
    filterQueryRef.value?.blur()
  } else if (e.key === 'Enter') {
    const list = childrenList.value?.list ?? state.value?.[colTitle.value]

    if (childrenListPagination.query && ncIsArray(list) && list.length) {
      linkOrUnLink(list[0], '0')
    }
  }
}
</script>

<template>
  <div class="nc-modal-child-list h-full w-full" :class="{ active: vModel }" @keydown.enter.stop>
    <div class="flex flex-col h-full">
      <div class="nc-dropdown-link-record-header bg-gray-100 py-2 rounded-t-xl flex justify-between pl-3 pr-2 gap-2">
        <div class="flex-1 nc-dropdown-link-record-search-wrapper flex items-center py-0.5 rounded-md">
          <a-input
            ref="filterQueryRef"
            v-model:value="childrenListPagination.query"
            :bordered="false"
            placeholder="Search linked records..."
            class="w-full min-h-4 !pl-0"
            size="small"
            @focus="isSearchInputFocused = true"
            @blur="isSearchInputFocused = false"
            @change="onFilterChange"
            @keydown.capture.stop="handleKeyDown"
          >
            <template #prefix>
              <GeneralIcon icon="search" class="nc-search-icon mr-2 h-4 w-4 text-gray-500" />
            </template>
          </a-input>
        </div>
        <LazyVirtualCellComponentsHeader
          data-testid="nc-link-count-info"
          :linked-records="totalItemsToShow"
          :related-table-title="relatedTableMeta?.title"
          :relation="relation"
          :table-title="meta?.title"
        />
      </div>
      <div ref="childrenListRef" class="flex-1 overflow-auto nc-scrollbar-thin">
        <div v-if="isDataExist || isChildrenLoading">
          <div class="cursor-pointer">
            <template v-if="isChildrenLoading">
              <div
                v-for="(_x, i) in Array.from({ length: skeletonCount })"
                :key="i"
                class="flex flex-row gap-3 px-3 py-2 transition-all relative border-b-1 border-gray-200 hover:bg-gray-50"
              >
                <div class="flex items-center">
                  <a-skeleton-image class="!h-11 !w-11 !rounded-md overflow-hidden children:(!h-full !w-full)" />
                </div>
                <div class="flex flex-col gap-2 flex-grow justify-center">
                  <a-skeleton-input active class="h-4 !w-48 !rounded-md overflow-hidden" size="small" />
                  <div class="flex flex-row gap-6 w-10/12">
                    <a-skeleton-input
                      v-for="idx of [1, 2, 3]"
                      :key="idx"
                      active
                      class="!h-3 !w-24 !rounded-md overflow-hidden"
                      size="small"
                    />
                  </div>
                </div>
              </div>
            </template>
            <template v-else>
              <LazyVirtualCellComponentsListItem
                v-for="(refRow, id) in childrenList?.list ?? state?.[colTitle] ?? []"
                :key="id"
                :attachment="attachmentCol"
                :display-value-type-and-format-prop="displayValueTypeAndFormatProp"
                :fields="fields"
                :is-linked="childrenList?.list ? isChildrenListLinked[Number.parseInt(id)] : true"
                :is-loading="isChildrenListLoading[Number.parseInt(id)]"
                :is-selected="!!(isSearchInputFocused && childrenListPagination.query && Number.parseInt(id) === 0)"
                :related-table-display-value-prop="relatedTableDisplayValueProp"
                :row="refRow"
                data-testid="nc-child-list-item"
                @link-or-unlink="linkOrUnLink(refRow, id)"
                @expand="onClick(refRow)"
                @keydown.space.prevent.stop="() => linkOrUnLink(refRow, id)"
                @keydown.enter.prevent.stop="() => linkOrUnLink(refRow, id)"
              />
            </template>
          </div>
        </div>
        <div v-else class="h-full flex flex-col gap-2 my-auto items-center justify-center text-gray-500 text-center">
          <img
            :alt="$t('msg.clickLinkRecordsToAddLinkFromTable')"
            class="!w-[158px] flex-none"
            src="~assets/img/placeholder/link-records.png"
          />
          <div class="text-base text-gray-700 font-bold">{{ $t('msg.noLinkedRecords') }}</div>
          <div class="text-gray-700">
            {{ $t('msg.clickLinkRecordsToAddLinkFromTable') }}
          </div>

          <NcButton
            v-if="!readOnly && (childrenListCount < 1 || (childrenList?.list ?? state?.[colTitle] ?? []).length > 0)"
            v-e="['c:links:link']"
            data-testid="nc-child-list-button-link-to"
            size="small"
            @click="emit('attachRecord')"
          >
            <div class="flex items-center gap-1"><MdiPlus /> {{ $t('title.linkRecords') }}</div>
          </NcButton>
        </div>
      </div>

      <div class="nc-dropdown-link-record-footer bg-gray-100 p-2 rounded-b-xl flex items-center justify-between gap-3 min-h-11">
        <div class="flex items-center gap-2">
          <NcButton
            v-if="!isPublic && !isDataReadOnly"
            v-e="['c:row-expand:open']"
            size="small"
            class="!hover:(bg-white text-brand-500) !h-7 !text-small"
            type="secondary"
            @click="addNewRecord"
          >
            <div class="flex items-center gap-1">
              <MdiPlus v-if="!isMobileMode" class="h-4 w-4" /> {{ $t('activity.newRecord') }}
            </div>
          </NcButton>
          <NcButton
            v-if="!readOnly && (childrenListCount > 0 || (childrenList?.list ?? state?.[colTitle] ?? []).length > 0)"
            v-e="['c:links:link']"
            data-testid="nc-child-list-button-link-to"
            class="!hover:(bg-white text-brand-500) !h-7 !text-small"
            size="small"
            type="secondary"
            @click="emit('attachRecord')"
          >
            <div class="flex items-center gap-1">
              <GeneralIcon icon="link2" class="!xs:hidden h-4 w-4" />
              {{ isMobileMode ? $t('title.linkMore') : $t('title.linkMoreRecords') }}
            </div>
          </NcButton>
        </div>
        <template v-if="!isNew && childrenList?.pageInfo && +childrenList.pageInfo.totalRows! > childrenListPagination.size">
          <div class="flex justify-center items-center">
            <NcPagination
              v-model:current="childrenListPagination.page"
              v-model:page-size="childrenListPagination.size"
              :total="+childrenList.pageInfo.totalRows!"
              mode="simple"
            />
          </div>
        </template>
      </div>
    </div>

    <Suspense>
      <LazySmartsheetExpandedForm
        v-if="expandedFormRow && expandedFormDlg"
        v-model="expandedFormDlg"
        :load-row="!isPublic"
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
          oldRow: expandedFormRow,
          rowMeta: !isNewRecord
            ? {}
            : {
                new: true,
              },
        }"
        :state="newRowState"
        :row-id="extractPkFromRow(expandedFormRow, relatedTableMeta.columns as ColumnType[])"
        use-meta-fields
        maintain-default-view-order
        :new-record-submit-btn-text="!isNewRecord ? undefined : 'Create & Link'"
        @created-record="onCreatedRecord"
      />
    </Suspense>
  </div>
</template>

<style lang="scss" scoped>
:deep(.nc-nested-list-item .ant-card-body) {
  @apply !px-1 !py-0;
}

:deep(.ant-modal-content) {
  @apply !p-0;
}

:deep(.ant-skeleton-element .ant-skeleton-image-svg) {
  @apply !w-7;
}
</style>

<style lang="scss">
.nc-dropdown-link-record-search-wrapper {
  .nc-search-icon {
    @apply flex-none text-gray-500;
  }

  &:focus-within {
    .nc-search-icon {
      @apply text-gray-600;
    }
  }
  input {
    &::placeholder {
      @apply text-gray-500;
    }
  }
}
</style>
