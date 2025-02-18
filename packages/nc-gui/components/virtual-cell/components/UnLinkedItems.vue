<script lang="ts" setup>
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { RelationTypes, isLinksOrLTAR, isSystemColumn } from 'nocodb-sdk'
import InboxIcon from '~icons/nc-icons/inbox'

const props = defineProps<{ modelValue: boolean; column: any; hideBackBtn?: boolean }>()

const emit = defineEmits(['update:modelValue', 'addNewRecord', 'attachLinkedRecord', 'escape'])

const vModel = useVModel(props, 'modelValue', emit)

const { isMobileMode } = useGlobal()

const injectedColumn = inject(ColumnInj)

const { isSharedBase } = storeToRefs(useBase())

const filterQueryRef = ref<HTMLInputElement>()

const { t } = useI18n()

const { $e } = useNuxtApp()

const { isDataReadOnly } = useRoles()

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
  resetChildrenExcludedOffsetCount,
} = useLTARStoreOrThrow()

const { addLTARRef, isNew, removeLTARRef, state: rowState } = useSmartsheetRowStoreOrThrow()

const isPublic = inject(IsPublicInj, ref(false))

const isExpandedFormCloseAfterSave = ref(false)

const isNewRecord = ref(false)

isChildrenExcludedLoading.value = true

const isForm = inject(IsFormInj, ref(false))

const saveRow = inject(SaveRowInj, () => {})

const reloadTrigger = inject(ReloadRowDataHookInj, createEventHook())

const reloadViewDataTrigger = inject(ReloadViewDataHookInj, createEventHook())

const relation = computed(() => {
  return injectedColumn!.value?.colOptions?.type
})

const linkRow = async (row: Record<string, any>, id: number) => {
  if (isNew.value) {
    await addLTARRef(row, injectedColumn?.value as ColumnType)
    if (relation.value === 'oo' || relation.value === 'bt') {
      isChildrenExcludedListLinked.value.forEach((isLinked, idx) => {
        if (isLinked) {
          isChildrenExcludedListLinked.value[idx] = false
        }
        if (id === idx) {
          isChildrenExcludedListLinked.value[idx] = true
        }
      })
    } else {
      isChildrenExcludedListLinked.value[id] = true
    }

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
      loadChildrenExcludedList(rowState.value, true)
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

  if (relatedTableColOpt.type === RelationTypes.BELONGS_TO || relatedTableColOpt.type === RelationTypes.ONE_TO_ONE) {
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
    .sort((a, b) => {
      return (a.meta?.defaultViewColOrder ?? Infinity) - (b.meta?.defaultViewColOrder ?? Infinity)
    })
    .slice(0, isMobileMode.value ? 1 : 3)
})

const totalItemsToShow = computed(() => {
  if (isForm.value || isNew.value) {
    if (relation.value === 'bt' || relation.value === 'oo') {
      return rowState.value?.[injectedColumn!.value?.title] ? 1 : 0
    }

    return rowState.value?.[injectedColumn!.value?.title]?.length ?? 0
  }

  if (relation.value === 'bt') {
    return row.value?.row[relatedTableMeta.value?.title] ? 1 : 0
  }

  if (relation.value === 'oo') {
    return row.value?.row[injectedColumn!.value?.title] ? 1 : 0
  }

  return childrenListCount.value ?? 0
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
  isNewRecord.value = true
}

const onCreatedRecord = (record: any) => {
  addLTARRef(record, injectedColumn?.value as ColumnType)

  reloadTrigger?.trigger({
    shouldShowLoading: false,
  })
  reloadViewDataTrigger?.trigger({
    shouldShowLoading: false,
  })

  if (!isNewRecord.value) {
    vModel.value = false

    return
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

  vModel.value = false
  isNewRecord.value = false
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

  setTimeout(() => {
    filterQueryRef.value?.focus()
  }, 100)
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

const isSearchInputFocused = ref(false)

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (!childrenExcludedListPagination.query) emit('escape')
    filterQueryRef.value?.blur()
  } else if (e.key === 'Enter') {
    if (
      childrenExcludedListPagination.query &&
      ncIsArray(childrenExcludedList.value?.list) &&
      childrenExcludedList.value?.list.length
    ) {
      onClick(childrenExcludedList.value?.list[0], '0')
    }
  }
}
</script>

<template>
  <div class="nc-modal-link-record h-full w-full overflow-hidden" :class="{ active: vModel }" @keydown.enter.stop>
    <div class="flex flex-col h-full">
      <div class="nc-dropdown-link-record-header bg-gray-100 py-2 rounded-t-xl flex justify-between pl-3 pr-2 gap-2">
        <div class="flex-1 gap-2 flex items-center">
          <button
            v-if="!hideBackBtn"
            class="!text-brand-500 hover:!text-brand-700 p-1.5 flex"
            @click="emit('attachLinkedRecord')"
          >
            <GeneralIcon icon="ncArrowLeft" class="flex-none h-4 w-4" />
          </button>

          <div class="flex-1 nc-dropdown-link-record-search-wrapper flex items-center py-0.5 rounded-md">
            <a-input
              ref="filterQueryRef"
              v-model:value="childrenExcludedListPagination.query"
              :bordered="false"
              placeholder="Search records to link..."
              class="w-full nc-excluded-search min-h-4 !pl-0"
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
        </div>
        <LazyVirtualCellComponentsHeader
          data-testid="nc-link-count-info"
          :linked-records="totalItemsToShow"
          :related-table-title="relatedTableMeta?.title"
          :relation="relation"
          :table-title="meta?.title"
        />
      </div>
      <div class="flex-1 overflow-auto nc-scrollbar-thin">
        <template v-if="childrenExcludedList?.pageInfo?.totalRows">
          <div ref="childrenExcludedListRef">
            <template v-if="isChildrenExcludedLoading">
              <div
                v-for="(_x, i) in Array.from({ length: 10 })"
                :key="i"
                class="flex flex-row gap-3 px-3 py-2 transition-all relative border-b-1 border-gray-200 hover:c"
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
                v-for="(refRow, id) in childrenExcludedList?.list ?? []"
                :key="id"
                :attachment="attachmentCol"
                :display-value-type-and-format-prop="displayValueTypeAndFormatProp"
                :fields="fields"
                :is-linked="isChildrenExcludedListLinked[Number.parseInt(id)]"
                :is-loading="isChildrenExcludedListLoading[Number.parseInt(id)]"
                :is-selected="!!(isSearchInputFocused && childrenExcludedListPagination.query && Number.parseInt(id) === 0)"
                :related-table-display-value-prop="relatedTableDisplayValueProp"
                :row="refRow"
                data-testid="nc-excluded-list-item"
                @link-or-unlink="onClick(refRow, id)"
                @expand="
                  () => {
                    expandedFormRow = refRow
                    expandedFormDlg = true
                  }
                "
                @keydown.space.prevent.stop="() => onClick(refRow, id)"
                @keydown.enter.prevent.stop="() => onClick(refRow, id)"
              />
            </template>
          </div>
        </template>
        <div v-else class="h-full my-auto py-2 flex flex-col gap-3 items-center justify-center text-gray-500">
          <InboxIcon class="w-16 h-16 mx-auto" />

          <p v-if="childrenExcludedListPagination.query">{{ $t('msg.noRecordsMatchYourSearchQuery') }}</p>
          <p v-else>
            {{ $t('msg.noRecordsAvailForLinking') }}
          </p>
        </div>
      </div>
      <div class="nc-dropdown-link-record-footer bg-gray-100 p-2 rounded-b-xl flex items-center justify-between min-h-11">
        <div class="flex">
          <NcButton
            v-if="!isPublic && !isDataReadOnly"
            v-e="['c:row-expand:open']"
            size="small"
            class="!hover:(bg-white text-brand-500) !h-7 !text-small"
            type="secondary"
            @click="addNewRecord"
          >
            <div class="flex items-center gap-1"><MdiPlus v-if="!isMobileMode" /> {{ $t('activity.newRecord') }}</div>
          </NcButton>
        </div>
        <template
          v-if="
            childrenExcludedList?.pageInfo && +childrenExcludedList?.pageInfo?.totalRows > childrenExcludedListPagination.size
          "
        >
          <div v-if="isMobileMode" class="flex items-center">
            <NcPagination
              v-model:current="childrenExcludedListPagination.page"
              v-model:page-size="childrenExcludedListPagination.size"
              :total="+childrenExcludedList?.pageInfo?.totalRows"
              entity-name="links-excluded-list"
            />
          </div>
          <div v-else class="flex items-center">
            <NcPagination
              v-model:current="childrenExcludedListPagination.page"
              v-model:page-size="childrenExcludedListPagination.size"
              :total="+childrenExcludedList?.pageInfo?.totalRows"
              entity-name="links-excluded-list"
              mode="simple"
            />
          </div>
        </template>
      </div>
    </div>
    <Suspense>
      <LazySmartsheetExpandedForm
        v-if="expandedFormDlg"
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
          oldRow: {},
          rowMeta: !isNewRecord
            ? {}
            : {
                new: true,
              },
        }"
        :row-id="extractPkFromRow(expandedFormRow, relatedTableMeta.columns as ColumnType[])"
        :state="newRowState"
        use-meta-fields
        maintain-default-view-order
        :skip-reload="true"
        :new-record-submit-btn-text="!isNewRecord ? undefined : 'Create & Link'"
        @created-record="onCreatedRecord"
      />
    </Suspense>
  </div>
</template>

<style lang="scss" scoped>
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
