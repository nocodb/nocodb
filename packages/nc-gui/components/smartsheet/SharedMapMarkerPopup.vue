<script lang="ts" setup>
import type { ColumnType, TableType } from 'nocodb-sdk'
import type { Ref } from 'vue'

import { ViewTypes, isVirtualCol } from 'nocodb-sdk'
import {
  ActiveViewInj,
  ChangePageInj,
  FieldsInj,
  IsFormInj,
  IsGalleryInj,
  IsGridInj,
  MetaInj,
  PaginationDataInj,
  ReloadRowDataHookInj,
  ReloadViewDataHookInj,
  ReloadViewMetaHookInj,
  computed,
  inject,
  isImage,
  isLTAR,
  nextTick,
  onMounted,
  provide,
  ref,
  useAttachment,
  useViewData,
} from '#imports'
import type { Row } from '~/lib'

interface Attachment {
  url: string
}

const props = defineProps<{
  fields: ColumnType[]
  row: Row
}>()

const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())
const reloadViewMetaHook = inject(ReloadViewMetaHookInj)
const reloadViewDataHook = inject(ReloadViewDataHookInj)

const { loadData, paginationData, loadGalleryData, galleryData, changePage } = useViewData(meta, view)

provide(IsFormInj, ref(false))
provide(IsGalleryInj, ref(true))
provide(IsGridInj, ref(false))
provide(PaginationDataInj, paginationData)
provide(ChangePageInj, changePage)

const fields = inject(FieldsInj, ref([]))

const { getPossibleAttachmentSrc } = useAttachment()

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
    if (coverImageColumn?.title && record.row[coverImageColumn.title]) {
      return typeof record.row[coverImageColumn.title] === 'string'
        ? JSON.parse(record.row[coverImageColumn.title])
        : record.row[coverImageColumn.title]
    }
    return []
  } catch (e) {
    return []
  }
}

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

provide(ReloadRowDataHookInj, reloadViewDataHook)

watch(view, async (nextView) => {
  if (nextView?.type === ViewTypes.GALLERY) {
    await loadData()
    await loadGalleryData()
  }
})

const currentRow = toRef(props, 'row')

const { row } = useProvideSmartsheetRowStore(meta as Ref<TableType>, currentRow)
</script>

<template>
  <LazySmartsheetRow :row="row">
    <a-card
      hoverable
      class="!rounded-lg h-full overflow-hidden break-all max-w-[450px]"
      :data-testid="`nc-gallery-card-${row.row.id}`"
    >
      <template v-if="galleryData?.fk_cover_image_col_id" #cover>
        <a-carousel v-if="!reloadAttachments && attachments(row).length" autoplay class="gallery-carousel" arrows>
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

          <template v-for="(attachment, index) in attachments(row)">
            <LazyCellAttachmentImage
              v-if="isImage(attachment.title, attachment.mimetype ?? attachment.type)"
              :key="`carousel-${row.row.id}-${index}`"
              class="h-52 object-contain"
              :srcs="getPossibleAttachmentSrc(attachment)"
            />
          </template>
        </a-carousel>

        <MdiFileImageBox v-else class="w-full h-48 my-4 text-cool-gray-200" />
      </template>

      <div v-for="col in fieldsWithoutCover" :key="`record-${row.row.id}-${col.id}`">
        <div
          v-if="!isRowEmpty(row, col) || isLTAR(col.uidt)"
          class="flex flex-col space-y-1 px-4 mb-6 bg-gray-50 rounded-lg w-full"
        >
          <div class="flex flex-row w-full justify-start border-b-1 border-gray-100 py-2.5">
            <div class="w-full text-gray-600">
              <LazySmartsheetHeaderVirtualCell v-if="isVirtualCol(col)" :column="col" :hide-menu="true" />

              <LazySmartsheetHeaderCell v-else :column="col" :hide-menu="true" />
            </div>
          </div>

          <div class="flex flex-row w-full pb-3 pt-2 pl-2 items-center justify-start">
            <LazySmartsheetVirtualCell v-if="isVirtualCol(col)" v-model="row.row[col.title]" :column="col" :row="row" />

            <LazySmartsheetCell v-else v-model="row.row[col.title]" :column="col" :edit-enabled="false" :read-only="true" />
          </div>
        </div>
      </div>
    </a-card>
  </LazySmartsheetRow>
</template>
