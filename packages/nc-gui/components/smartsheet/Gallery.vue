<script lang="ts" setup>
import { ViewTypes, isVirtualCol } from 'nocodb-sdk'
import {
  ActiveViewInj,
  ChangePageInj,
  FieldsInj,
  IsFormInj,
  IsGalleryInj,
  IsGridInj,
  MetaInj,
  OpenNewRecordFormHookInj,
  PaginationDataInj,
  ReloadRowDataHookInj,
  ReloadViewDataHookInj,
  ReloadViewMetaHookInj,
  computed,
  createEventHook,
  extractPkFromRow,
  inject,
  nextTick,
  onMounted,
  provide,
  ref,
  useViewData,
} from '#imports'
import type { Row as RowType } from '~/lib'

interface Attachment {
  url: string
}

const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())
const reloadViewMetaHook = inject(ReloadViewMetaHookInj)
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
} = useViewData(meta, view)

provide(IsFormInj, ref(false))
provide(IsGalleryInj, ref(true))
provide(IsGridInj, ref(false))
provide(PaginationDataInj, paginationData)
provide(ChangePageInj, changePage)

const fields = inject(FieldsInj, ref([]))

const route = useRoute()

const router = useRouter()

const fieldsWithoutCover = computed(() => fields.value.filter((f) => f.id !== galleryData.value?.fk_cover_image_col_id))

const coverImageColumn: any = $(
  computed(() =>
    meta.value?.columnsById
      ? meta.value.columnsById[galleryData.value?.fk_cover_image_col_id as keyof typeof meta.value.columnsById]
      : {},
  ),
)

const isRowEmpty = (record: any, col: any) => {
  const val = record.row[col.title]
  if (!val) return true

  return Array.isArray(val) && val.length === 0
}

const attachments = (record: any): Attachment[] => {
  try {
    return coverImageColumn?.title && record.row[coverImageColumn.title] ? JSON.parse(record.row[coverImageColumn.title]) : []
  } catch (e) {
    return []
  }
}

const expandForm = (row: RowType, state?: Record<string, any>) => {
  const rowId = extractPkFromRow(row.row, meta.value!.columns!)

  if (rowId) {
    router.push({
      query: {
        ...route.query,
        rowId,
      },
    })
  } else {
    expandedFormRow.value = row
    expandedFormRowState.value = state
    expandedFormDlg.value = true
  }
}

const expandFormClick = async (e: MouseEvent, row: RowType) => {
  const target = e.target as HTMLElement
  if (target && !target.closest('.gallery-carousel')) {
    expandForm(row)
  }
}

openNewRecordFormHook?.on(async () => {
  const newRow = await addEmptyRow()
  expandForm(newRow)
})

const expandedFormOnRowIdDlg = computed({
  get() {
    return !!route.query.rowId
  },
  set(val) {
    if (!val)
      router.push({
        query: {
          ...route.query,
          rowId: undefined,
        },
      })
  },
})

const reloadAttachments = ref(false)

reloadViewMetaHook?.on(async () => {
  await loadGalleryData()

  reloadAttachments.value = true

  nextTick(() => {
    reloadAttachments.value = false
  })
})
reloadViewDataHook?.on(async () => {
  await loadData()
})

onMounted(async () => {
  await loadData()

  await loadGalleryData()
})

// provide view data reload hook as fallback to row data reload
provide(ReloadRowDataHookInj, reloadViewDataHook)

watch(view, async (nextView) => {
  if (nextView?.type === ViewTypes.GALLERY) {
    await loadData()
    await loadGalleryData()
  }
})
</script>

<template>
  <div class="flex flex-col h-full w-full overflow-auto nc-gallery" data-testid="nc-gallery-wrapper">
    <div class="nc-gallery-container grid gap-2 my-4 px-3">
      <div v-for="record in data" :key="`record-${record.row.id}`">
        <LazySmartsheetRow :row="record">
          <a-card
            hoverable
            class="!rounded-lg h-full overflow-hidden break-all max-w-[450px]"
            :data-testid="`nc-gallery-card-${record.row.id}`"
            @click="expandFormClick($event, record)"
          >
            <template v-if="galleryData?.fk_cover_image_col_id" #cover>
              <a-carousel v-if="!reloadAttachments && attachments(record).length" autoplay class="gallery-carousel" arrows>
                <template #customPaging>
                  <a>
                    <div class="pt-[12px]">
                      <div></div>
                    </div>
                  </a>
                </template>

                <template #prevArrow>
                  <div style="z-index: 1"></div>
                </template>

                <template #nextArrow>
                  <div style="z-index: 1"></div>
                </template>

                <LazyNuxtImg
                  v-for="(attachment, index) in attachments(record)"
                  :key="`carousel-${record.row.id}-${index}`"
                  quality="90"
                  placeholder
                  class="h-52 object-contain"
                  :src="attachment.url"
                />
              </a-carousel>

              <MdiFileImageBox v-else class="w-full h-48 my-4 text-cool-gray-200" />
            </template>

            <div v-for="col in fieldsWithoutCover" :key="`record-${record.row.id}-${col.id}`">
              <div v-if="!isRowEmpty(record, col)" class="flex flex-col space-y-1 px-4 mb-6 bg-gray-50 rounded-lg w-full">
                <div class="flex flex-row w-full justify-start border-b-1 border-gray-100 py-2.5">
                  <div class="w-full text-gray-600">
                    <LazySmartsheetHeaderVirtualCell v-if="isVirtualCol(col)" :column="col" :hide-menu="true" />

                    <LazySmartsheetHeaderCell v-else :column="col" :hide-menu="true" />
                  </div>
                </div>

                <div class="flex flex-row w-full pb-3 pt-2 pl-2 items-center justify-start">
                  <LazySmartsheetVirtualCell
                    v-if="isVirtualCol(col)"
                    v-model="record.row[col.title]"
                    :column="col"
                    :row="record"
                  />

                  <LazySmartsheetCell
                    v-else
                    v-model="record.row[col.title]"
                    :column="col"
                    :edit-enabled="false"
                    :read-only="true"
                  />
                </div>
              </div>
            </div>
          </a-card>
        </LazySmartsheetRow>
      </div>
    </div>

    <div class="flex-1" />

    <LazySmartsheetPagination />

    <Suspense>
      <LazySmartsheetExpandedForm
        v-if="expandedFormRow && expandedFormDlg"
        v-model="expandedFormDlg"
        :row="expandedFormRow"
        :state="expandedFormRowState"
        :meta="meta"
        :view="view"
      />
    </Suspense>

    <Suspense>
      <LazySmartsheetExpandedForm
        v-if="expandedFormOnRowIdDlg"
        :key="route.query.rowId"
        v-model="expandedFormOnRowIdDlg"
        :row="{ row: {}, oldRow: {}, rowMeta: {} }"
        :meta="meta"
        :row-id="route.query.rowId"
        :view="view"
      />
    </Suspense>
  </div>
</template>

<style scoped>
.nc-gallery-container {
  grid-auto-rows: 1fr;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
}

:deep(.slick-dots li button) {
  background-color: black;
}

.ant-carousel.gallery-carousel :deep(.slick-dots) {
  position: relative;
  height: auto;
  bottom: 0;
}

.ant-carousel.gallery-carousel :deep(.slick-dots li div > div) {
  background: #000;
  border: 0;
  border-radius: 1px;
  color: transparent;
  cursor: pointer;
  display: block;
  font-size: 0;
  height: 3px;
  opacity: 0.3;
  outline: none;
  padding: 0;
  transition: all 0.5s;
  width: 100%;
}

.ant-carousel.gallery-carousel :deep(.slick-dots li.slick-active div > div) {
  opacity: 1;
}

.ant-carousel.gallery-carousel :deep(.slick-prev) {
  left: 0;
  height: 100%;
  top: 12px;
  width: 50%;
}

.ant-carousel.gallery-carousel :deep(.slick-next) {
  right: 0;
  height: 100%;
  top: 12px;
  width: 50%;
}
</style>
