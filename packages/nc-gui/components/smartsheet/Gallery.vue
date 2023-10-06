<script lang="ts" setup>
import { ViewTypes, isVirtualCol } from 'nocodb-sdk'
import type { Row as RowType } from '#imports'
import {
  ActiveViewInj,
  FieldsInj,
  IsFormInj,
  IsGalleryInj,
  IsGridInj,
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
  isPrimary,
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

provide(RowHeightInj, ref(1 as const))

const fields = inject(FieldsInj, ref([]))

const route = useRoute()

const router = useRouter()

const { getPossibleAttachmentSrc } = useAttachment()

const fieldsWithoutDisplay = computed(() => fields.value.filter((f) => !isPrimary(f)))

const displayField = computed(() => meta.value?.columns?.find((c) => c.pv && fields.value.includes(c)) ?? null)

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

const { isUIAllowed } = useRoles()
const hasEditPermission = computed(() => isUIAllowed('dataEdit'))
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
  if (target.closest('.arrow') || target.closest('.slick-dots')) return
  expandForm(row)
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
          <div v-e="['a:row:delete']" class="nc-base-menu-item">
            <!-- Delete Row -->
            {{ $t('activity.deleteRow') }}
          </div>
        </a-menu-item>

        <!--        <a-menu-item v-if="contextMenuTarget" @click="openNewRecordFormHook.trigger()"> -->
        <!--          <div v-e="['a:row:insert']" class="nc-base-menu-item"> -->
        <!--            &lt;!&ndash; Insert New Row &ndash;&gt; -->
        <!--            {{ $t('activity.insertRow') }} -->
        <!--          </div> -->
        <!--        </a-menu-item> -->
      </a-menu>
    </template>

    <div
      class="flex flex-col w-full nc-gallery nc-scrollbar-md bg-[#fbfbfb]"
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
      <div v-else class="nc-gallery-container grid gap-3 my-4 px-3">
        <div v-for="(record, rowIndex) in data" :key="`record-${record.row.id}`">
          <LazySmartsheetRow :row="record">
            <a-card
              class="!rounded-lg h-full border-gray-200 border-1 group overflow-hidden break-all max-w-[450px] shadow-sm hover:shadow-md cursor-pointer"
              :body-style="{ padding: '0px' }"
              :data-testid="`nc-gallery-card-${record.row.id}`"
              @click="expandFormClick($event, record)"
              @contextmenu="showContextMenu($event, { row: rowIndex })"
            >
              <template v-if="galleryData?.fk_cover_image_col_id" #cover>
                <a-carousel
                  v-if="!reloadAttachments && attachments(record).length"
                  class="gallery-carousel !border-b-1 !border-gray-200"
                  arrows
                >
                  <template #customPaging>
                    <a>
                      <div class="pt-[12px]">
                        <div></div>
                      </div>
                    </a>
                  </template>

                  <template #prevArrow>
                    <div class="z-10 arrow">
                      <MdiChevronLeft
                        class="text-gray-700 w-6 h-6 absolute left-1.5 bottom-[-90px] !opacity-0 !group-hover:opacity-100 !bg-white border-1 border-gray-200 rounded-md transition"
                      />
                    </div>
                  </template>

                  <template #nextArrow>
                    <div class="z-10 arrow">
                      <MdiChevronRight
                        class="text-gray-700 w-6 h-6 absolute right-1.5 bottom-[-90px] !opacity-0 !group-hover:opacity-100 !bg-white border-1 border-gray-200 rounded-md transition"
                      />
                    </div>
                  </template>

                  <template v-for="(attachment, index) in attachments(record)">
                    <LazyCellAttachmentImage
                      v-if="isImage(attachment.title, attachment.mimetype ?? attachment.type)"
                      :key="`carousel-${record.row.id}-${index}`"
                      class="h-52 object-cover"
                      :srcs="getPossibleAttachmentSrc(attachment)"
                      @click="expandFormClick($event, record)"
                    />
                  </template>
                </a-carousel>
                <div v-else class="h-52 w-full !flex flex-row !border-b-1 !border-gray-200 items-center justify-center">
                  <img class="object-contain w-[48px] h-[48px]" src="~assets/icons/FileIconImageBox.png" />
                </div>
              </template>
              <h2 v-if="displayField" class="text-base mt-3 mx-3 font-bold">
                <LazySmartsheetVirtualCell
                  v-if="isVirtualCol(displayField)"
                  v-model="record.row[displayField.title]"
                  class="!text-gray-600"
                  :column="displayField"
                  :row="record"
                />

                <LazySmartsheetCell
                  v-else
                  v-model="record.row[displayField.title]"
                  class="!text-gray-600"
                  :column="displayField"
                  :edit-enabled="false"
                  :read-only="true"
                />
              </h2>

              <div v-for="col in fieldsWithoutDisplay" :key="`record-${record.row.id}-${col.id}`">
                <div class="flex flex-col first:mt-3 ml-2 !pr-3.5 !mb-[0.75rem] rounded-lg w-full">
                  <div class="flex flex-row w-full justify-start scale-75">
                    <div class="w-full pb-1 text-gray-300">
                      <LazySmartsheetHeaderVirtualCell
                        v-if="isVirtualCol(col)"
                        :column="col"
                        :hide-menu="true"
                        :hide-icon="true"
                      />

                      <LazySmartsheetHeaderCell v-else :column="col" :hide-menu="true" :hide-icon="true" />
                    </div>
                  </div>

                  <div
                    v-if="!isRowEmpty(record, col)"
                    class="flex flex-row w-full text-gray-700 px-1 mt-[-0.25rem] items-center justify-start"
                  >
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
                  <div v-else class="flex flex-row w-full h-[1.375rem] pl-1 items-center justify-start">-</div>
                </div>
              </div>
            </a-card>
          </LazySmartsheetRow>
        </div>
      </div>
    </div>
  </a-dropdown>

  <LazySmartsheetPagination v-model:pagination-data="paginationData" show-api-timing :change-page="changePage" />
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
  @apply auto-rows-[1fr] grid-cols-[repeat(auto-fit,minmax(250px,1fr))];
}

:deep(.slick-dots li button) {
  @apply !bg-black;
}

.ant-carousel.gallery-carousel :deep(.slick-dots) {
  @apply !w-auto absolute h-auto bottom-[-15px] absolute h-auto;
  height: auto;
}

.ant-carousel.gallery-carousel :deep(.slick-dots li div > div) {
  @apply rounded-full border-0 cursor-pointer block opacity-100 p-0 outline-none transition-all duration-500 text-transparent h-2 w-2 bg-[#d9d9d9];
  font-size: 0;
}

.ant-carousel.gallery-carousel :deep(.slick-dots li.slick-active div > div) {
  @apply bg-brand-500 opacity-100;
}

.ant-carousel.gallery-carousel :deep(.slick-dots li) {
  @apply !w-auto;
}
.ant-carousel.gallery-carousel :deep(.slick-prev) {
  @apply left-0;
}

.ant-carousel.gallery-carousel :deep(.slick-next) {
  @apply right-0;
}
</style>
