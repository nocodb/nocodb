<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import type { Row } from '~/lib'
import {
  ColumnInj,
  Empty,
  IsFormInj,
  IsPublicInj,
  Modal,
  ReadonlyInj,
  computed,
  h,
  iconMap,
  inject,
  ref,
  useLTARStoreOrThrow,
  useSmartsheetRowStoreOrThrow,
  useVModel,
  watch,
} from '#imports'

const props = defineProps<{ modelValue?: boolean; cellValue: any }>()

const emit = defineEmits(['update:modelValue', 'attachRecord'])

const vModel = useVModel(props, 'modelValue', emit)

const isForm = inject(IsFormInj, ref(false))

const isPublic = inject(IsPublicInj, ref(false))

const column = inject(ColumnInj, ref())

const readonly = inject(ReadonlyInj, ref(false))

const {
  childrenList,
  deleteRelatedRow,
  loadChildrenList,
  childrenListPagination,
  relatedTableDisplayValueProp,
  unlink,
  getRelatedTableRowId,
  relatedTableMeta,
} = useLTARStoreOrThrow()

const { isNew, state, removeLTARRef } = useSmartsheetRowStoreOrThrow()

watch(
  [vModel, isForm],
  (nextVal) => {
    if ((nextVal[0] || nextVal[1]) && !isNew.value) {
      loadChildrenList()
    }
  },
  { immediate: true },
)

const unlinkRow = async (row: Record<string, any>) => {
  if (isNew.value) {
    await removeLTARRef(row, column?.value as ColumnType)
  } else {
    await unlink(row)
    await loadChildrenList()
  }
}

const unlinkIfNewRow = async (row: Record<string, any>) => {
  if (isNew.value) {
    await removeLTARRef(row, column?.value as ColumnType)
  }
}

const container = computed(() =>
  isForm.value
    ? h('div', {
        class: 'w-full p-2',
      })
    : Modal,
)

const expandedFormDlg = ref(false)

const expandedFormRow = ref()

const colTitle = $computed(() => column.value?.title || '')

/** reload children list whenever cell value changes and list is visible */
watch(
  () => props.cellValue,
  () => {
    if (!isNew.value && vModel.value) loadChildrenList()
  },
)

const onClick = (row: Row) => {
  if (readonly.value) return
  expandedFormRow.value = row
  expandedFormDlg.value = true
}
</script>

<template>
  <component
    :is="container"
    v-model:visible="vModel"
    :footer="null"
    title="Child list"
    :body-style="{ padding: 0 }"
    wrap-class-name="nc-modal-child-list"
  >
    <div class="max-h-[max(calc(100vh_-_300px)_,500px)] flex flex-col py-6">
      <div class="flex mb-4 items-center gap-2 px-12">
        <div class="flex-1" />
        <component
          :is="iconMap.reload"
          v-if="!isForm"
          class="cursor-pointer text-gray-500"
          data-testid="nc-child-list-reload"
          @click="loadChildrenList"
        />

        <a-button
          v-if="!readonly"
          type="primary"
          ghost
          class="!text-xs"
          data-testid="nc-child-list-button-link-to"
          size="small"
          @click="emit('attachRecord')"
        >
          <div class="flex items-center gap-1">
            <component :is="iconMap.link" class="text-xs" type="primary" />
            Link to '
            <GeneralTableIcon :meta="relatedTableMeta" class="-mx-1 w-5" />
            {{ relatedTableMeta.title }}'
          </div>
        </a-button>
      </div>

      <template v-if="(isNew && state?.[colTitle]?.length) || childrenList?.pageInfo?.totalRows">
        <div class="flex-1 overflow-auto min-h-0 scrollbar-thin-dull px-12 cursor-pointer">
          <a-card
            v-for="(row, i) of childrenList?.list ?? state?.[colTitle] ?? []"
            :key="i"
            class="!my-4 hover:(!bg-gray-200/50 shadow-md)"
            @click="onClick(row)"
          >
            <div class="flex items-center">
              <div class="flex-1 overflow-hidden min-w-0">
                {{ row[relatedTableDisplayValueProp] }}
                <span class="text-gray-400 text-[11px] ml-1">(Primary key : {{ getRelatedTableRowId(row) }})</span>
              </div>

              <div v-if="!readonly" class="flex gap-2">
                <component
                  :is="iconMap.linkRemove"
                  class="text-xs text-grey hover:(!text-red-500) cursor-pointer"
                  data-testid="nc-child-list-icon-unlink"
                  @click.stop="unlinkRow(row)"
                />
                <component
                  :is="iconMap.delete"
                  v-if="!readonly && !isPublic"
                  class="text-xs text-grey hover:(!text-red-500) cursor-pointer"
                  data-testid="nc-child-list-icon-delete"
                  @click.stop="deleteRelatedRow(row, unlinkIfNewRow)"
                />
              </div>
            </div>
          </a-card>
        </div>

        <div class="flex justify-center mt-6">
          <a-pagination
            v-if="!isNew && childrenList?.pageInfo"
            v-model:current="childrenListPagination.page"
            v-model:page-size="childrenListPagination.size"
            class="mt-2 mx-auto"
            size="small"
            :total="childrenList?.pageInfo.totalRows"
            show-less-items
          />
        </div>
      </template>
      <a-empty
        v-else
        :class="{ 'my-10': !isForm, 'my-1 !text-xs': isForm }"
        :image="Empty.PRESENTED_IMAGE_SIMPLE"
        :image-style="isForm ? { height: '20px' } : {}"
      />
    </div>

    <Suspense>
      <LazySmartsheetExpandedForm
        v-if="expandedFormRow && expandedFormDlg"
        v-model="expandedFormDlg"
        :row="{ row: expandedFormRow, oldRow: expandedFormRow, rowMeta: {} }"
        :meta="relatedTableMeta"
        load-row
        use-meta-fields
      />
    </Suspense>
  </component>
</template>

<style scoped lang="scss">
:deep(.ant-pagination-item a) {
  line-height: 21px !important;
}
</style>
