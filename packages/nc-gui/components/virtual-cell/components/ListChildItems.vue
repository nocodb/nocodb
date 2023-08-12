<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import type { Row } from '#imports'
import {
  ColumnInj,
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
  deleteRelatedRow,
  loadChildrenList,
  childrenListPagination,
  relatedTableDisplayValueProp,
  unlink,
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
    await removeLTARRef(row, injectedColumn?.value as ColumnType)
  } else {
    await unlink(row)
    await loadChildrenList()
  }
}

const unlinkIfNewRow = async (row: Record<string, any>) => {
  if (isNew.value) {
    await removeLTARRef(row, injectedColumn?.value as ColumnType)
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

const colTitle = computed(() => injectedColumn.value?.title || '')

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
    <div class="py-6 nc-scrollbar-md">
      <div class="flex mb-4 items-center gap-2 px-12">
        <component
          :is="iconMap.reload"
          v-if="!isForm"
          class="cursor-pointer text-gray-500"
          data-testid="nc-child-list-reload"
          @click="loadChildrenList"
        />

        <a-button v-if="!readonly" type="primary" ghost data-testid="nc-child-list-button-link-to" @click="emit('attachRecord')">
          <div class="flex items-center gap-1">
            <component :is="iconMap.link" type="primary" />
            Link to '
            <GeneralTableIcon :meta="relatedTableMeta" class="-mx-1 w-5" />
            {{ relatedTableMeta.title }}'
          </div>
        </a-button>
      </div>

      <template v-if="(isNew && state?.[colTitle]?.length) || childrenList?.pageInfo?.totalRows">
        <div class="nc-scrollbar-md">
          <div class="flex flex-col">
            <div class="px-12 cursor-pointer">
              <a-card
                v-for="(row, i) of childrenList?.list ?? state?.[colTitle] ?? []"
                :key="i"
                class="nc-nested-list-item !my-2 hover:(!bg-gray-200/50 shadow-md)"
                @click="onClick(row)"
              >
                <div class="flex items-center">
                  <div class="flex-1 overflow-hidden min-w-0">
                    <VirtualCellComponentsItemChip
                      :border="false"
                      :item="row"
                      :value="row[relatedTableDisplayValueProp]"
                      :column="props.column"
                    />
                  </div>

                  <div v-if="!readonly" class="flex gap-2">
                    <component
                      :is="iconMap.linkRemove"
                      class="!text-base text-grey hover:(!text-red-500) cursor-pointer nc-icon-transition"
                      data-testid="nc-child-list-icon-unlink"
                      @click.stop="unlinkRow(row)"
                    />
                    <component
                      :is="iconMap.delete"
                      v-if="!readonly && !isPublic"
                      class="!text-base text-grey hover:(!text-red-500) cursor-pointer nc-icon-transition"
                      data-testid="nc-child-list-icon-delete"
                      @click.stop="deleteRelatedRow(row, unlinkIfNewRow)"
                    />
                  </div>
                </div>
              </a-card>
            </div>
          </div>
        </div>
        <div class="flex justify-center mt-6">
          <a-pagination
            v-if="!isNew && childrenList?.pageInfo"
            v-model:current="childrenListPagination.page"
            v-model:page-size="childrenListPagination.size"
            class="mt-2 mx-auto"
            size="small"
            :total="+childrenList?.pageInfo.totalRows"
            show-less-items
          />
        </div>
      </template>

      <div v-else class="ml-12 text-gray-500">No Links</div>
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

:deep(.nc-nested-list-item .ant-card-body) {
  @apply !px-1 !py-0;
}
</style>
