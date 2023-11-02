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
  onKeyStroke,
  ref,
  useLTARStoreOrThrow,
  useSmartsheetRowStoreOrThrow,
  useVModel,
} from '#imports'

interface Prop {
  modelValue?: boolean
  cellValue: any
  column: any
  items: number
}

const props = defineProps<Prop>()

const emit = defineEmits(['update:modelValue', 'attachRecord'])

const vModel = useVModel(props, 'modelValue', emit)

const { isMobileMode } = useGlobal()

const isForm = inject(IsFormInj, ref(false))

const isPublic = inject(IsPublicInj, ref(false))

const injectedColumn = inject(ColumnInj, ref())

const readonly = inject(ReadonlyInj, ref(false))

const { isSharedBase } = storeToRefs(useBase())

const {
  childrenList,
  childrenListCount,
  loadChildrenList,
  childrenListPagination,
  relatedTableDisplayValueProp,
  unlink,
  isChildrenListLoading,
  isChildrenListLinked,
  isChildrenLoading,
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
    .slice(0, isMobileMode.value ? 1 : 4)
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
  if (!expandedFormDlg.value) {
    loadChildrenList()
  }
})

onKeyStroke('Escape', () => {
  vModel.value = false
})

/*
   to render same number of skelton as the number of cards
   displayed
 */
const skeltonCount = computed(() => {
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

  if (isPublic.value && !isForm.value) return
  if (isNew.value || isChildrenListLinked.value[parseInt(id)]) {
    unlinkRow(rowRef, parseInt(id))
  } else {
    linkRow(rowRef, parseInt(id))
  }
}
</script>

<template>
  <NcModal
    v-model:visible="vModel"
    :class="{ active: vModel }"
    :footer="null"
    :closable="false"
    size="medium"
    :width="isForm ? 600 : 800"
    :body-style="{ 'max-height': '640px', 'height': '85vh' }"
    wrap-class-name="nc-modal-child-list"
  >
    <LazyVirtualCellComponentsHeader
      v-if="!isForm"
      :relation="relation"
      :linked-records="childrenListCount"
      :table-title="meta?.title"
      :show-header="true"
      :related-table-title="relatedTableMeta?.title"
      :display-value="row.row[displayValueProp]"
    />
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
          class="w-full !sm:rounded-md xs:min-h-8 !xs:rounded-xl"
          size="small"
          :bordered="false"
          @focus="isFocused = true"
          @blur="isFocused = false"
          @keydown.capture.stop
          @change="childrenListPagination.page = 1"
        >
        </a-input>
      </div>
    </div>
    <div class="flex flex-col flex-grow nc-scrollbar-md cursor-pointer pr-1">
      <div v-if="isDataExist || isChildrenLoading" class="mt-2 mb-2">
        <div class="cursor-pointer pr-1">
          <template v-if="isChildrenLoading">
            <div
              v-for="(x, i) in Array.from({ length: skeltonCount })"
              :key="i"
              class="!border-2 flex flex-row gap-2 mb-2 transition-all !rounded-xl relative !border-gray-200 hover:bg-gray-50"
            >
              <a-skeleton-image class="h-24 w-24 !rounded-xl" />
              <div class="flex flex-col m-[.5rem] gap-2 flex-grow justify-center">
                <a-skeleton-input class="!w-48 !rounded-xl" active size="small" />
                <div class="flex flex-row gap-6 w-10/12">
                  <div class="flex flex-col gap-0.5">
                    <a-skeleton-input class="!h-4 !w-12" active size="small" />
                    <a-skeleton-input class="!h-4 !w-24" active size="small" />
                  </div>
                  <div class="flex flex-col gap-0.5">
                    <a-skeleton-input class="!h-4 !w-12" active size="small" />
                    <a-skeleton-input class="!h-4 !w-24" active size="small" />
                  </div>
                  <div class="flex flex-col gap-0.5">
                    <a-skeleton-input class="!h-4 !w-12" active size="small" />
                    <a-skeleton-input class="!h-4 !w-24" active size="small" />
                  </div>
                  <div class="flex flex-col gap-0.5">
                    <a-skeleton-input class="!h-4 !w-12" active size="small" />
                    <a-skeleton-input class="!h-4 !w-24" active size="small" />
                  </div>
                </div>
              </div>
            </div>
          </template>
          <template v-else>
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
              @click="linkOrUnLink(refRow, id)"
            />
          </template>
        </div>
      </div>
      <div v-else class="pt-1 flex flex-col gap-3 my-auto items-center justify-center text-gray-500">
        <InboxIcon class="w-16 h-16 mx-auto" />
        <p>
          {{ $t('msg.noRecordsAreLinkedFromTable') }}
          {{ relatedTableMeta?.title }}
        </p>
        <NcButton
          v-if="!readonly && childrenListCount < 1"
          v-e="['c:links:link']"
          data-testid="nc-child-list-button-link-to"
          @click="emit('attachRecord')"
        >
          <div class="flex items-center gap-1"><MdiPlus /> {{ $t('title.linkMoreRecords') }}</div>
        </NcButton>
      </div>
    </div>

    <div v-if="isMobileMode" class="flex flex-row justify-center items-center w-full my-2">
      <NcPagination
        v-if="!isNew && childrenList?.pageInfo"
        v-model:current="childrenListPagination.page"
        v-model:page-size="childrenListPagination.size"
        :total="+childrenList.pageInfo.totalRows!"
      />
    </div>

    <div class="my-2 bg-gray-50 border-gray-50 border-b-2"></div>

    <div class="flex flex-row justify-between bg-white relative pt-1">
      <div v-if="!isForm" class="flex items-center justify-center px-2 rounded-md text-gray-500 bg-brand-50">
        {{ totalItemsToShow || 0 }} {{ !isMobileMode ? $t('objects.records') : '' }}
        {{ !isMobileMode && totalItemsToShow !== 0 ? $t('general.are') : '' }}
        {{ $t('general.linked') }}
      </div>
      <div v-else class="flex items-center justify-center px-2 rounded-md text-gray-500 bg-brand-50">
        <span class="">
          {{ state?.[colTitle]?.length || 0 }} {{ $t('objects.records') }}
          {{ state?.[colTitle]?.length !== 0 ? $t('general.are') : '' }}
          {{ $t('general.linked') }}
        </span>
      </div>
      <div class="!xs:hidden flex absolute -mt-0.75 items-center py-2 justify-center w-full">
        <NcPagination
          v-if="!isNew && childrenList?.pageInfo"
          v-model:current="childrenListPagination.page"
          v-model:page-size="childrenListPagination.size"
          :total="+childrenList.pageInfo.totalRows!"
          mode="simple"
        />
      </div>
      <div class="flex flex-row gap-2">
        <NcButton v-if="!isForm" type="ghost" class="nc-close-btn" @click="vModel = false"> {{ $t('general.finish') }} </NcButton>
        <NcButton
          v-if="!readonly && childrenListCount > 0"
          v-e="['c:links:link']"
          data-testid="nc-child-list-button-link-to"
          @click="emit('attachRecord')"
        >
          <div class="flex items-center gap-1">
            <MdiPlus class="!xs:hidden" /> {{ isMobileMode ? $t('title.linkMore') : $t('title.linkMoreRecords') }}
          </div>
        </NcButton>
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
        :row-id="extractPkFromRow(expandedFormRow, relatedTableMeta.columns as ColumnType[])"
        use-meta-fields
      />
    </Suspense>
  </NcModal>
</template>

<style scoped lang="scss">
:deep(.nc-nested-list-item .ant-card-body) {
  @apply !px-1 !py-0;
}

:deep(.ant-modal-content) {
  @apply !p-0;
}
</style>

<style lang="scss">
.nc-modal-child-list > .ant-modal > .ant-modal-content {
  @apply !p-0;
}
</style>
