<script lang="ts" setup>
import { isVirtualCol } from 'nocodb-sdk'
import { inject, provide, useViewData } from '#imports'
import Row from '~/components/smartsheet/Row.vue'
import type { Row as RowType } from '~/composables'
import {
  ActiveViewInj,
  ChangePageInj,
  FieldsInj,
  IsFormInj,
  IsGridInj,
  MetaInj,
  OpenNewRecordFormHookInj,
  PaginationDataInj,
  ReadonlyInj,
} from '~/context'
import ImageIcon from '~icons/mdi/file-image-box'

interface Attachment {
  url: string
}

const meta = inject(MetaInj)
const view = inject(ActiveViewInj)
const reloadViewDataHook = inject(ReloadViewDataHookInj)
const openNewRecordFormHook = inject(OpenNewRecordFormHookInj, createEventHook())

const expandedFormDlg = ref(false)
const expandedFormRow = ref<RowType>()
const expandedFormRowState = ref<Record<string, any>>()

const {
  loadData,
  paginationData,
  formattedData: data,
  loadGalleryData,
  galleryData,
  changePage,
  addEmptyRow,
} = useViewData(meta, view as any)

const { isUIAllowed } = useUIPermission()

provide(IsFormInj, ref(false))
provide(IsGridInj, false)
provide(PaginationDataInj, paginationData)
provide(ChangePageInj, changePage)
provide(ReadonlyInj, !isUIAllowed('xcDatatableEditable'))

const fields = inject(FieldsInj, ref([]))

const coverImageColumn: any = $(
  computed(() =>
    meta?.value.columnsById
      ? meta.value.columnsById[galleryData.value?.fk_cover_image_col_id as keyof typeof meta.value.columnsById]
      : {},
  ),
)

watch(
  [meta, view],
  async () => {
    if (meta?.value && view?.value) {
      await loadData()
      await loadGalleryData()
    }
  },
  { immediate: true },
)

const isRowEmpty = (record: any, col: any) => {
  const val = record.row[col.title]
  if (!val) return true

  return Array.isArray(val) && val.length === 0
}

const attachments = (record: any): Array<Attachment> => {
  try {
    return coverImageColumn?.title ? JSON.parse(record.row[coverImageColumn.title]) : []
  } catch (e) {
    return []
  }
}

reloadViewDataHook?.on(async () => {
  await loadData()
})

const expandForm = (row: RowType, state?: Record<string, any>) => {
  if (!isUIAllowed('xcDatatableEditable')) return
  expandedFormRow.value = row
  expandedFormRowState.value = state
  expandedFormDlg.value = true
}

openNewRecordFormHook?.on(async () => {
  const newRow = await addEmptyRow()
  expandForm(newRow)
})
</script>

<template>
  <div class="flex flex-col h-full w-full overflow-auto">
    <div class="nc-gallery-container grid w-full min-h-0 flex-1 gap-x-2 my-4 px-3">
      <div v-for="(record, recordIndex) in data" :key="recordIndex" class="flex flex-col" @click="expandForm(record)">
        <Row :row="record">
          <a-card hoverable class="!rounded-lg h-full overflow-hidden break-all">
            <template #cover>
              <a-carousel v-if="attachments(record).length !== 0" autoplay>
                <img v-for="(attachment, index) in attachments(record)" :key="index" class="h-52" :src="attachment.url" />
              </a-carousel>
              <ImageIcon v-else class="w-full h-48 my-4 text-cool-gray-200" />
            </template>

            <div v-for="col in fields" :key="col.id" class="flex flex-col space-y-1 px-4 mb-6 bg-gray-50 rounded-lg w-full">
              <div class="flex flex-row w-full justify-start border-b-1 border-gray-100 py-2.5">
                <div class="w-full text-gray-600">
                  <SmartsheetHeaderVirtualCell v-if="isVirtualCol(col)" :column="col" :hide-menu="true" />
                  <SmartsheetHeaderCell v-else :column="col" :hide-menu="true" />
                </div>
              </div>

              <div class="flex flex-row w-full pb-3 pt-2 pl-2 items-center justify-start">
                <div v-if="isRowEmpty(record, col)" class="h-3 bg-gray-200 px-5 rounded-lg"></div>
                <template v-else>
                  <SmartsheetVirtualCell v-if="isVirtualCol(col)" v-model="record.row[col.title]" :column="col" :row="record" />
                  <SmartsheetCell v-else v-model="record.row[col.title]" :column="col" :edit-enabled="false" :read-only="true" />
                </template>
              </div>
            </div>
          </a-card>
        </Row>
      </div>
    </div>
    <SmartsheetPagination />
    <SmartsheetExpandedForm
      v-if="expandedFormRow && expandedFormDlg"
      v-model="expandedFormDlg"
      :row="expandedFormRow"
      :state="expandedFormRowState"
      :meta="meta"
    />
  </div>
</template>

<style scoped>
.nc-gallery-container {
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
}
</style>
