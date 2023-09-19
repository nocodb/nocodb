<script lang="ts" setup>
import { type ColumnType, isLinksOrLTAR, isSystemColumn } from 'nocodb-sdk'
import type { Row } from '#imports'
import InboxIcon from '~icons/nc-icons/inbox'

import {
  ColumnInj,
  IsFormInj,
  IsPublicInj,
  ReadonlyInj,
  computed,
  inject,
  isPrimary,
  ref,
  useLTARStoreOrThrow,
  useSmartsheetRowStoreOrThrow,
  useVModel,
} from '#imports'

const props = defineProps<{ modelValue?: boolean; cellValue: any; column: any }>()

const emit = defineEmits(['update:modelValue', 'attachRecord'])

const vModel = useVModel(props, 'modelValue', emit)

const isForm = inject(IsFormInj, ref(false))

const isPublic = inject(IsPublicInj, ref(false))

const injectedColumn = inject(ColumnInj, ref())

const readonly = inject(ReadonlyInj, ref(false))

const {
  childrenList,
  childrenListCount,
  loadChildrenList,
  childrenListPagination,
  relatedTableDisplayValueProp,
  unlink,
  isChildrenListLoading,
  isChildrenListLinked,
  relatedTableMeta,
  row,
  link,
  meta,
  displayValueProp,
} = useLTARStoreOrThrow()

const { isNew, state, removeLTARRef, addLTARRef } = useSmartsheetRowStoreOrThrow()

watch(
  [vModel, isForm],
  (nextVal) => {
    if ((nextVal[0] || nextVal[1]) && !isNew.value) {
      loadChildrenList()
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

const isFocused = ref(false)

const fields = computedInject(FieldsInj, (_fields) => {
  return (relatedTableMeta.value.columns ?? [])
    .filter((col) => !isSystemColumn(col) && !isPrimary(col) && !isLinksOrLTAR(col) && !isAttachment(col))
    .slice(0, 4)
})

const expandedFormDlg = ref(false)

const expandedFormRow = ref({})

const colTitle = computed(() => injectedColumn.value?.title || '')

const onClick = (row: Row) => {
  if (readonly.value) return
  expandedFormRow.value = row
  expandedFormDlg.value = true
}

const relation = computed(() => {
  return injectedColumn!.value?.colOptions?.type
})

watch(
  () => props.cellValue,
  () => {
    if (isNew.value) loadChildrenList()
  },
)

watch(expandedFormDlg, () => {
  loadChildrenList()
})
</script>

<template>
  <a-modal
    v-model:visible="vModel"
    :class="{ active: vModel }"
    :footer="null"
    :closable="false"
    :width="isForm ? 600 : 800"
    :body-style="{ 'padding': 0, 'margin': 0, 'min-height': isForm ? '300px' : '500px' }"
    wrap-class-name="nc-modal-child-list"
  >
    <LazyVirtualCellComponentsHeader
      v-if="!isForm"
      :relation="relation"
      :linked-records="childrenListCount"
      :table-title="meta?.title"
      :related-table-title="relatedTableMeta?.title"
      :display-value="row.row[displayValueProp]"
    />
    <div v-if="!isForm" class="m-4 bg-gray-50 border-gray-50 border-b-2"></div>

    <div v-if="!isForm" class="flex mt-2 mb-2 items-center gap-2">
      <div
        class="flex items-center border-1 p-1 rounded-md w-full border-gray-200"
        :class="{ '!border-primary': childrenListPagination.query.length !== 0 || isFocused }"
      >
        <MdiMagnify class="w-5 h-5 ml-2" />
        <a-input
          ref="filterQueryRef"
          v-model:value="childrenListPagination.query"
          :placeholder="`Search in ${relatedTableMeta?.title}`"
          class="w-full !rounded-md"
          size="small"
          :bordered="false"
          @focus="isFocused = true"
          @blur="isFocused = false"
          @keydown.capture.stop
        >
        </a-input>
      </div>
    </div>

    <template v-if="(isNew && state?.[colTitle]?.length) || childrenList?.pageInfo?.totalRows">
      <div class="mt-2 mb-2">
        <div
          :class="{
            'h-[420px]': !isForm,
            'h-[250px]': isForm,
          }"
          class="overflow-scroll nc-scrollbar-md cursor-pointer pr-1"
        >
          <LazyVirtualCellComponentsListItem
            v-for="(refRow, id) in childrenList?.list ?? state?.[colTitle] ?? []"
            :key="id"
            :row="refRow"
            :fields="fields"
            data-testid="nc-child-list-item"
            :attachment="attachmentCol"
            :related-table-display-value-prop="relatedTableDisplayValueProp"
            :is-linked="childrenList?.list ? isChildrenListLinked[Number.parseInt(id)] : true"
            :is-loading="isChildrenListLoading[Number.parseInt(id)]"
            @expand="onClick(refRow)"
            @click="
              () => {
                if (isPublic && !isForm) return
                isNew
                  ? unlinkRow(refRow, Number.parseInt(id))
                  : isChildrenListLinked[Number.parseInt(id)]
                  ? unlinkRow(refRow, Number.parseInt(id))
                  : linkRow(refRow, Number.parseInt(id))
              }
            "
          />
        </div>
      </div>
    </template>
    <div
      v-else
      :class="{
        'h-[420px]': !isForm,
        'h-[250px]': isForm,
      }"
      class="pt-1 flex flex-col items-center justify-center text-gray-500"
    >
      <InboxIcon class="w-16 h-16 mx-auto" />
      <p>There are no records in table</p>
    </div>

    <div class="my-2 bg-gray-50 border-gray-50 border-b-2"></div>

    <div class="flex flex-row justify-between bg-white relative pt-1">
      <div v-if="!isForm" class="flex items-center justify-center px-2 rounded-md text-brand-500 bg-brand-50">
        {{ childrenListCount || 0 }} records {{ childrenListCount !== 0 ? 'are' : '' }} linked
      </div>
      <div v-else class="flex items-center justify-center px-2 rounded-md text-brand-500 bg-brand-50">
        {{ state?.[colTitle]?.length || 0 }} records {{ state?.[colTitle]?.length !== 0 ? 'are' : '' }} linked
      </div>
      <div class="flex absolute items-center py-2 justify-center w-full">
        <a-pagination
          v-if="!isNew && childrenList?.pageInfo"
          v-model:current="childrenListPagination.page"
          v-model:page-size="childrenListPagination.size"
          :total="+childrenList.pageInfo.totalRows!"
          :show-size-changer="false"
          class="mt-2 mx-auto"
          size="small"
          hide-on-single-page
          show-less-items
        />
      </div>
      <div class="flex flex-row gap-1">
        <NcButton v-if="!readonly" type="ghost" data-testid="nc-child-list-button-link-to" @click="emit('attachRecord')">
          <MdiPlus /> Link more records
        </NcButton>
        <NcButton v-if="!isForm" type="primary" class="nc-close-btn" @click="vModel = false"> Close </NcButton>
      </div>
    </div>

    <Suspense>
      <LazySmartsheetExpandedForm
        v-if="expandedFormRow && expandedFormDlg"
        v-model="expandedFormDlg"
        :meta="relatedTableMeta"
        :row="{
          row: expandedFormRow,
          oldRow: expandedFormRow,
          rowMeta:
            Object.keys(expandedFormRow).length > 0
              ? {}
              : {
                  new: true,
                },
        }"
        use-meta-fields
      />
    </Suspense>
  </a-modal>
</template>

<style scoped lang="scss">
:deep(.nc-nested-list-item .ant-card-body) {
  @apply !px-1 !py-0;
}
</style>
