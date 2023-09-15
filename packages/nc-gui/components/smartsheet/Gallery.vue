<script lang="ts" setup>
import { ViewTypes, isVirtualCol } from 'nocodb-sdk'
import type { Row as RowType } from '#imports'
import {
  ActiveViewInj,
  FieldsInj,
  IsFormInj,
  IsGalleryInj,
  IsGridInj,
  IsPublicInj,
  MetaInj,
  NavigateDir,
  OpenNewRecordFormHookInj,
  ReloadRowDataHookInj,
  ReloadViewDataHookInj,
  ReloadViewMetaHookInj,
  computed,
  createEventHook,
  extractPkFromRow,
  inject,
  isImage,
  isLTAR,
  nextTick,
  provide,
  ref,
  useAttachment,
  useViewData,
} from '#imports'

interface Attachment {
  url: string
}

const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())
const reloadViewMetaHook = inject(ReloadViewMetaHookInj)
const reloadViewDataHook = inject(ReloadViewDataHookInj)
const openNewRecordFormHook = inject(OpenNewRecordFormHookInj, createEventHook())

const { isViewDataLoading } = storeToRefs(useViewsStore())
const { isSqlView, xWhere } = useSmartsheetStoreOrThrow()
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
  deleteRow,
  navigateToSiblingRow,
} = useViewData(meta, view, xWhere)

provide(IsFormInj, ref(false))
provide(IsGalleryInj, ref(true))
provide(IsGridInj, ref(false))

const isPublic = inject(IsPublicInj, ref(false))

const fields = inject(FieldsInj, ref([]))

const route = useRoute()

const router = useRouter()

const { getPossibleAttachmentSrc } = useAttachment()

const fieldsWithoutCover = computed(() => fields.value.filter((f) => f.id !== galleryData.value?.fk_cover_image_col_id))

const coverImageColumn: any = computed(() =>
  meta.value?.columnsById
    ? meta.value.columnsById[galleryData.value?.fk_cover_image_col_id as keyof typeof meta.value.columnsById]
    : {},
)

const isRowEmpty = (record: any, col: any) => {
  const val = record.row[col.title]
  if (!val) return true

  return Array.isArray(val) && val.length === 0
}

const { isUIAllowed } = useUIPermission()
const hasEditPermission = computed(() => isUIAllowed('xcDatatableEditable'))
// TODO: extract this code (which is duplicated in grid and gallery) into a separate component
const _contextMenu = ref(false)
const contextMenu = computed({
  get: () => _contextMenu.value,
  set: (val) => {
    if (hasEditPermission.value) {
      _contextMenu.value = val
    }
  },
})
const contextMenuTarget = ref<{ row: number } | null>(null)

const showContextMenu = (e: MouseEvent, target?: { row: number }) => {
  if (isSqlView.value) return
  e.preventDefault()
  if (target) {
    contextMenuTarget.value = target
  }
}

const attachments = (record: any): Attachment[] => {
  try {
    if (coverImageColumn.value?.title && record.row[coverImageColumn.value.title]) {
      return typeof record.row[coverImageColumn.value.title] === 'string'
        ? JSON.parse(record.row[coverImageColumn.value.title])
        : record.row[coverImageColumn.value.title]
    }
    return []
  } catch (e) {
    return []
  }
}

const expandForm = (row: RowType, state?: Record<string, any>) => {
  if (isPublic.value) {
    return
  }

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

// provide view data reload hook as fallback to row data reload
provide(ReloadRowDataHookInj, reloadViewDataHook)

watch(
  view,
  async (nextView) => {
    isViewDataLoading.value = true
    try {
      if (nextView?.type === ViewTypes.GALLERY) {
        await loadData()
        await loadGalleryData()
      }
    } finally {
      isViewDataLoading.value = false
    }
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <a-dropdown
    v-model:visible="contextMenu"
    :trigger="isSqlView ? [] : ['contextmenu']"
    overlay-class-name="nc-dropdown-grid-context-menu"
  >
    <template #overlay>
      <a-menu class="shadow !rounded !py-0" @click="contextMenu = false">
        <a-menu-item v-if="contextMenuTarget" @click="deleteRow(contextMenuTarget.row)">
          <div v-e="['a:row:delete']" class="nc-project-menu-item">
            <!-- Delete Row -->
            {{ $t('activity.deleteRow') }}
          </div>
        </a-menu-item>

        <a-menu-item v-if="contextMenuTarget" @click="openNewRecordFormHook.trigger()">
          <div v-e="['a:row:insert']" class="nc-project-menu-item">
            <!-- Insert New Row -->
            {{ $t('activity.insertRow') }}
          </div>
        </a-menu-item>
      </a-menu>
    </template>

    <div
      class="flex flex-col w-full nc-gallery nc-scrollbar-md"
      data-testid="nc-gallery-wrapper"
      style="height: calc(100% - var(--topbar-height) + 0.7rem)"
      :class="{
        '!overflow-hidden': isViewDataLoading,
      }"
    >
      <div v-if="isViewDataLoading" class="flex flex-col h-full">
        <div class="flex flex-row p-3 !pr-1 gap-x-2 flex-wrap gap-y-2">
          <a-skeleton-input v-for="index of Array(20)" :key="index" class="!min-w-60.5 !h-96 !rounded-md overflow-hidden" />
        </div>
      </div>
      <div v-else class="nc-gallery-container grid gap-2 my-4 px-3">
        <div v-for="(record, rowIndex) in data" :key="`record-${record.row.id}`">
          <LazySmartsheetRow :row="record">
            <a-card
              hoverable
              class="!rounded-lg h-full overflow-hidden break-all max-w-[450px]"
              :data-testid="`nc-gallery-card-${record.row.id}`"
              :style="isPublic ? { cursor: 'default' } : { cursor: 'pointer' }"
              @click="expandFormClick($event, record)"
              @contextmenu="showContextMenu($event, { row: rowIndex })"
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

                  <template v-for="(attachment, index) in attachments(record)">
                    <LazyCellAttachmentImage
                      v-if="isImage(attachment.title, attachment.mimetype ?? attachment.type)"
                      :key="`carousel-${record.row.id}-${index}`"
                      class="h-52 object-contain"
                      :srcs="getPossibleAttachmentSrc(attachment)"
                    />
                  </template>
                </a-carousel>
                <div v-else class="h-52 w-full !flex flex-row items-center justify-center">
                  <img class="object-contain w-[48px] h-[48px]" src="~assets/icons/FileIconImageBox.png" />
                </div>
              </template>

              <div v-for="col in fieldsWithoutCover" :key="`record-${record.row.id}-${col.id}`">
                <div
                  v-if="!isRowEmpty(record, col) || isLTAR(col.uidt, col.colOptions)"
                  class="flex flex-col space-y-1 px-4 mb-6 bg-gray-50 rounded-lg w-full"
                >
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
    </div>
  </a-dropdown>

  <LazySmartsheetPagination v-model:pagination-data="paginationData" :change-page="changePage" />
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
      show-next-prev-icons
      @next="navigateToSiblingRow(NavigateDir.NEXT)"
      @prev="navigateToSiblingRow(NavigateDir.PREV)"
    />
  </Suspense>
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
