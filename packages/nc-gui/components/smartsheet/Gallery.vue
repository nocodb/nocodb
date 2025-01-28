<script setup lang="ts">
import { UITypes, ViewTypes, isVirtualCol } from 'nocodb-sdk'
import type { Attachment } from '../../lib/types'
import type { Row as RowType } from '#imports'

const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())
const reloadViewMetaHook = inject(ReloadViewMetaHookInj)
const reloadViewDataHook = inject(ReloadViewDataHookInj)
const openNewRecordFormHook = inject(OpenNewRecordFormHookInj, createEventHook())
const isPublic = inject(IsPublicInj, ref(false))
const fields = inject(FieldsInj, ref([]))

const { isViewDataLoading } = storeToRefs(useViewsStore())
const { isSqlView, xWhere } = useSmartsheetStoreOrThrow()
const { isUIAllowed } = useRoles()
const route = useRoute()
const { getPossibleAttachmentSrc } = useAttachment()
const router = useRouter()

const expandedFormDlg = ref(false)
const expandedFormRow = ref<RowType>()
const expandedFormRowState = ref<Record<string, any>>()

provide(IsFormInj, ref(false))
provide(IsGalleryInj, ref(true))
provide(IsGridInj, ref(false))
provide(IsCalendarInj, ref(false))
provide(RowHeightInj, ref(1 as const))
provide(ReloadRowDataHookInj, reloadViewDataHook!)

const {
  fetchChunk,
  loadGalleryData,
  deleteRow,
  syncCount,
  navigateToSiblingRow,
  chunkStates,
  cachedRows,
  totalRows,
  isFirstRow,
  isLastRow,
  clearCache,
  viewData: galleryData,
} = useGalleryViewData(meta, view, xWhere)

const fieldsWithoutDisplay = computed(() => fields.value.filter((f) => !isPrimary(f)))

const displayField = computed(() => meta.value?.columns?.find((c) => c.pv && fields.value.includes(c)) ?? null)

const coverImageColumn: any = computed(() =>
  meta.value?.columnsById
    ? meta.value.columnsById[galleryData.value?.fk_cover_image_col_id as keyof typeof meta.value.columnsById]
    : {},
)

const coverImageObjectFitClass = computed(() => {
  const fk_cover_image_object_fit = parseProp(galleryData.value?.meta)?.fk_cover_image_object_fit || CoverImageObjectFit.FIT
  if (fk_cover_image_object_fit === CoverImageObjectFit.FIT) return '!object-contain'
  if (fk_cover_image_object_fit === CoverImageObjectFit.COVER) return '!object-cover'
})

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
const contextMenuTarget = ref<{ row: RowType; index: number } | null>(null)

const showContextMenu = (e: MouseEvent, target?: { row: RowType; index: number }) => {
  if (isSqlView.value) return
  e.preventDefault()
  if (target) {
    contextMenuTarget.value = target
  }
}

const attachments = (record: any): Attachment[] => {
  if (!coverImageColumn.value?.title || !record.row[coverImageColumn.value.title]) return []

  try {
    const att =
      typeof record.row[coverImageColumn.value.title] === 'string'
        ? JSON.parse(record.row[coverImageColumn.value.title])
        : record.row[coverImageColumn.value.title]

    if (Array.isArray(att)) {
      return att
        .flat()
        .map((a) => (typeof a === 'string' ? JSON.parse(a) : a))
        .filter((a) => a && !Array.isArray(a) && typeof a === 'object' && Object.keys(a).length)
    }

    return []
  } catch (e) {
    return []
  }
}

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

const expandForm = (row: RowType, state?: Record<string, any>) => {
  const rowId = extractPkFromRow(row.row, meta.value!.columns!)
  expandedFormRowState.value = state

  if (rowId && !isPublic.value) {
    expandedFormRow.value = undefined

    router.push({
      query: {
        ...route.query,
        rowId,
      },
    })
  } else {
    expandedFormRow.value = row
    expandedFormDlg.value = true
  }
}

const expandFormClick = async (e: MouseEvent, row: RowType) => {
  const target = e.target as HTMLElement
  if (target.closest('.arrow') || target.closest('.slick-dots')) return
  expandForm(row)
}

const openNewRecordFormHookHandler = async () => {
  expandForm({
    row: { ...rowDefaultData(meta.value?.columns) },
    oldRow: {},
    rowMeta: { new: true },
  })
}

const handleClick = (col, event) => {
  if (isButton(col)) {
    event.stopPropagation()
  }
}

openNewRecordFormHook?.on(openNewRecordFormHookHandler)

onBeforeUnmount(() => openNewRecordFormHook.off(openNewRecordFormHookHandler))

const reloadAttachments = ref(false)

reloadViewMetaHook?.on(async () => {
  await loadGalleryData()

  reloadAttachments.value = true

  await nextTick(() => {
    reloadAttachments.value = false
  })
})

const CHUNK_SIZE = 50
const BUFFER_SIZE = 100
const PREFETCH_THRESHOLD = 30

const FIELD_HEIGHT = {
  [UITypes.LongText]: 150,
  [UITypes.Attachment]: 56,
  default: 44,
}

const scrollContainer = ref()

const scrollTop = ref(0)

const rowSlice = reactive({
  start: 0,
  end: 12,
})

const { width: scrollContainerWidth } = useElementSize(scrollContainer)

const columnsPerRow = computed(() => {
  if (scrollContainerWidth.value <= 537) return 1
  return Math.floor((scrollContainerWidth.value - 537) / 262) + 2
})

const cardHeight = computed(() => {
  // Calculate cardHeight in pixels From the FIELD_HEIGHT_MAP and if the card has cover image
  // 208 px for Card Image Height

  // 32 px for displayField
  // 16 px padding top and bottom
  // 12 px gap between each field
  // 2 px for border
  const displayFieldHeight = 32 + 16 + 16

  const fieldsHeight = fieldsWithoutDisplay.value.reduce((acc, field) => {
    const fieldHeight = FIELD_HEIGHT[field!.uidt!] || FIELD_HEIGHT.default
    return acc + fieldHeight + 12
  }, 0)

  return displayFieldHeight + fieldsHeight + (galleryData.value?.fk_cover_image_col_id ? 208 : 0) + 2
})

const visibleRows = computed(() => {
  const { start, end } = rowSlice
  return Array.from({ length: Math.min(end, totalRows.value) - start }, (_, i) => {
    const rowIndex = start + i
    return cachedRows.value.get(rowIndex) || { row: {}, oldRow: {}, rowMeta: { rowIndex, isLoading: true } }
  })
})

const updateVisibleRows = async () => {
  const { start, end } = rowSlice

  const firstChunkId = Math.floor(start / CHUNK_SIZE)
  const lastChunkId = Math.floor((end - 1) / CHUNK_SIZE)

  const chunksToFetch = new Set()

  for (let chunkId = firstChunkId; chunkId <= lastChunkId; chunkId++) {
    if (!chunkStates.value[chunkId]) chunksToFetch.add(chunkId)
  }

  const nextChunkId = lastChunkId + 1
  if (end % CHUNK_SIZE > CHUNK_SIZE - PREFETCH_THRESHOLD && !chunkStates.value[nextChunkId]) {
    chunksToFetch.add(nextChunkId)
  }

  const prevChunkId = firstChunkId - 1
  if (prevChunkId >= 0 && start % CHUNK_SIZE < PREFETCH_THRESHOLD && !chunkStates.value[prevChunkId]) {
    chunksToFetch.add(prevChunkId)
  }

  if (chunksToFetch.size > 0) {
    await Promise.all([...chunksToFetch].map((chunkId) => fetchChunk(chunkId)))
  }

  clearCache(Math.max(0, start - BUFFER_SIZE), Math.min(totalRows.value, end + BUFFER_SIZE))
}

const containerTransformY = ref(0)

const calculateSlices = () => {
  if (!scrollContainer.value) {
    setTimeout(calculateSlices, 50)
    return
  }

  const { clientHeight } = scrollContainer.value

  const visibleRowStart = Math.floor(scrollTop.value / (cardHeight.value + 12))

  const rowsVisible = Math.ceil((clientHeight - 12) / (cardHeight.value + 12))

  const BUFFER_ROWS = 2

  const startRecordIndex = Math.max(0, visibleRowStart - BUFFER_ROWS) * columnsPerRow.value
  const endRecordIndex = Math.min((visibleRowStart + rowsVisible + BUFFER_ROWS) * columnsPerRow.value, totalRows.value)

  rowSlice.start = startRecordIndex
  rowSlice.end = endRecordIndex

  const val = Math.ceil(rowSlice.start / columnsPerRow.value) * (cardHeight.value + 12)

  containerTransformY.value = val

  updateVisibleRows()
}

const containerHeight = computed(() => {
  const numberOfRows = Math.ceil(totalRows.value / columnsPerRow.value)
  return numberOfRows * cardHeight.value + (numberOfRows - 1) * 12
})

let scrollRaf = false

useScroll(scrollContainer, {
  onScroll: (e) => {
    if (scrollRaf) return
    scrollRaf = true
    requestAnimationFrame(() => {
      scrollTop.value = e.target?.scrollTop || 0
      calculateSlices()
      scrollRaf = false
    })
  },
  throttle: 200,
})

watch(
  view,
  async (nextView) => {
    isViewDataLoading.value = true
    try {
      if (nextView?.type === ViewTypes.GALLERY) {
        await loadGalleryData()

        await syncCount()
        if (rowSlice.end === 0) {
          rowSlice.end = Math.min(100, totalRows.value)
        }
        await updateVisibleRows()
      }
    } finally {
      isViewDataLoading.value = false
    }
  },
  {
    immediate: true,
  },
)

const placeholderAboveHeight = computed(() => {
  const visibleRowStart = Math.floor(scrollTop.value / (cardHeight.value + 12))

  const startRecordIndex = Math.max(0, visibleRowStart - 2)
  const placeholderHeight = startRecordIndex * (cardHeight.value + 12)

  if (placeholderHeight > containerHeight.value) {
    return containerHeight.value - cardHeight.value
  }
  return placeholderHeight
})

const { width, height } = useWindowSize()

watch(
  [() => width.value, () => height.value, () => columnsPerRow.value, () => scrollContainerWidth.value],
  () => {
    calculateSlices()
  },
  {
    immediate: true,
  },
)

reloadViewDataHook?.on(async () => {
  clearCache(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)
  await syncCount()
  calculateSlices()
})
</script>

<template>
  <div
    ref="scrollContainer"
    data-testid="nc-gallery-wrapper"
    class="flex flex-col w-full nc-gallery select-none relative nc-scrollbar-md bg-gray-50 h-[calc(100svh-93px)]"
  >
    <NcDropdown
      v-model:visible="contextMenu"
      :disabled="contextMenuTarget === null"
      :trigger="isSqlView ? [] : ['contextmenu']"
      overlay-class-name="nc-dropdown-grid-context-menu"
    >
      <template #overlay>
        <NcMenu variant="small" @click="contextMenu = false">
          <NcMenuItem v-if="contextMenuTarget" @click="expandForm(contextMenuTarget.row)">
            <div v-e="['a:row:expand-record']" class="flex items-center gap-2">
              <component :is="iconMap.maximize" class="flex" />
              {{ $t('activity.expandRecord') }}
            </div>
          </NcMenuItem>
          <NcDivider />
          <NcMenuItem
            v-if="contextMenuTarget?.index !== undefined"
            class="!text-red-600 !hover:bg-red-50"
            @click="deleteRow(contextMenuTarget.index)"
          >
            <div v-e="['a:row:delete']" class="flex items-center gap-2">
              <component :is="iconMap.delete" class="flex" />
              {{ $t('activity.deleteRow') }}
            </div>
          </NcMenuItem>
        </NcMenu>
      </template>
      <div class="flex-1">
        <div :key="containerHeight" class="relative" :style="{ height: `${containerHeight}px` }">
          <div :style="{ height: `${placeholderAboveHeight}px` }"></div>
          <div class="nc-gallery-container grid gap-3 p-3">
            <div
              v-for="(record, rowIndex) in visibleRows"
              :key="`record-${record.rowMeta.rowIndex}`"
              :data-card-id="`record-${record.rowMeta.rowIndex}`"
            >
              <LazySmartsheetRow :row="record">
                <a-card
                  class="!rounded-xl h-full border-gray-200 border-1 group overflow-hidden break-all max-w-[450px] cursor-pointer"
                  :body-style="{ padding: '16px !important' }"
                  :data-testid="`nc-gallery-card-${record.rowMeta.rowIndex}`"
                  @click="expandFormClick($event, record)"
                  @contextmenu="showContextMenu($event, { row: record, index: rowIndex })"
                >
                  <template v-if="galleryData?.fk_cover_image_col_id" #cover>
                    <a-carousel
                      v-if="!reloadAttachments && attachments(record).length"
                      class="gallery-carousel !border-b-1 !border-gray-200 min-h-52"
                      arrows
                    >
                      <template #customPaging>
                        <a>
                          <div>
                            <div></div>
                          </div>
                        </a>
                      </template>
                      <template #prevArrow>
                        <div class="z-10 arrow">
                          <NcButton
                            type="secondary"
                            size="xsmall"
                            class="!absolute !left-1.5 !bottom-[-90px] !opacity-0 !group-hover:opacity-100 !rounded-lg cursor-pointer"
                          >
                            <GeneralIcon icon="arrowLeft" class="text-gray-700 w-4 h-4" />
                          </NcButton>
                        </div>
                      </template>
                      <template #nextArrow>
                        <div class="z-10 arrow">
                          <NcButton
                            type="secondary"
                            size="xsmall"
                            class="!absolute !right-1.5 !bottom-[-90px] !opacity-0 !group-hover:opacity-100 !rounded-lg cursor-pointer"
                          >
                            <GeneralIcon icon="arrowRight" class="text-gray-700 w-4 h-4" />
                          </NcButton>
                        </div>
                      </template>
                      <template v-for="(attachment, index) in attachments(record)">
                        <LazyCellAttachmentPreviewImage
                          v-if="isImage(attachment.title, attachment.mimetype ?? attachment.type)"
                          :key="`carousel-${record.rowMeta.rowIndex}-${index}`"
                          class="h-52"
                          :class="[`${coverImageObjectFitClass}`]"
                          :srcs="getPossibleAttachmentSrc(attachment, 'card_cover')"
                          @click="expandFormClick($event, record)"
                        />
                      </template>
                    </a-carousel>
                    <div v-else class="h-52 w-full !flex flex-row !border-b-1 !border-gray-200 items-center justify-center">
                      <img class="object-contain w-[48px] h-[48px]" src="~assets/icons/FileIconImageBox.png" />
                    </div>
                  </template>
                  <div class="flex flex-col gap-3 !children:pointer-events-none">
                    <h2
                      v-if="displayField"
                      class="nc-card-display-value-wrapper"
                      :class="{
                        '!children:pointer-events-auto':
                          isButton(displayField) ||
                          (isRowEmpty(record, displayField) && isAllowToRenderRowEmptyField(displayField)),
                      }"
                    >
                      <template v-if="!isRowEmpty(record, displayField) || isAllowToRenderRowEmptyField(displayField)">
                        <LazySmartsheetVirtualCell
                          v-if="isVirtualCol(displayField)"
                          v-model="record.row[displayField.title]"
                          class="!text-brand-500"
                          :column="displayField"
                          :row="record"
                        />
                        <LazySmartsheetCell
                          v-else
                          v-model="record.row[displayField.title]"
                          class="!text-brand-500"
                          :column="displayField"
                          :edit-enabled="false"
                          :read-only="true"
                        />
                      </template>
                      <template v-else> - </template>
                    </h2>
                    <div
                      v-for="col in fieldsWithoutDisplay"
                      :key="`record-${record.rowMeta.rowIndex}-${col.id}`"
                      class="nc-card-col-wrapper"
                      :class="{
                        '!children:pointer-events-auto':
                          isButton(col) || (isRowEmpty(record, col) && isAllowToRenderRowEmptyField(col)),
                      }"
                      @click="handleClick(col, $event)"
                    >
                      <div class="flex flex-col rounded-lg w-full">
                        <div class="flex flex-row w-full justify-start">
                          <div class="nc-card-col-header w-full !children:text-gray-500">
                            <LazySmartsheetHeaderVirtualCell v-if="isVirtualCol(col)" :column="col" :hide-menu="true" />
                            <LazySmartsheetHeaderCell v-else :column="col" :hide-menu="true" />
                          </div>
                        </div>
                        <div
                          v-if="!isRowEmpty(record, col) || isAllowToRenderRowEmptyField(col)"
                          class="flex flex-row w-full text-gray-800 items-center justify-start min-h-7 py-1"
                        >
                          <LazySmartsheetVirtualCell
                            v-if="isVirtualCol(col)"
                            v-model="record.row[col.title]"
                            :column="col"
                            :row="record"
                            class="!text-gray-800"
                          />
                          <LazySmartsheetCell
                            v-else
                            v-model="record.row[col.title]"
                            :column="col"
                            :edit-enabled="false"
                            :read-only="true"
                            class="!text-gray-800"
                          />
                        </div>
                        <div v-else class="flex flex-row w-full h-7 pl-1 items-center justify-start">-</div>
                      </div>
                    </div>
                  </div>
                </a-card>
              </LazySmartsheetRow>
            </div>

            <template v-if="visibleRows.length <= 4">
              <div v-for="index of Array(8 - visibleRows.length)" :key="index" class="nc-empty-card"></div>
            </template>
          </div>
        </div>
      </div>
    </NcDropdown>
    <div class="sticky bottom-4">
      <NcButton v-if="isUIAllowed('dataInsert')" size="xs" type="secondary" class="ml-4" @click="openNewRecordFormHook.trigger">
        <div class="flex items-center gap-2">
          <component :is="iconMap.plus" class="" />
          {{ $t('activity.newRecord') }}
        </div>
      </NcButton>
    </div>
  </div>
  <Suspense>
    <LazySmartsheetExpandedForm
      v-if="expandedFormRow && expandedFormDlg"
      v-model="expandedFormDlg"
      :row="expandedFormRow"
      :load-row="!isPublic"
      :first-row="isFirstRow"
      :last-row="isLastRow"
      :state="expandedFormRowState"
      :meta="meta"
      :view="view"
    />
  </Suspense>
  <Suspense>
    <LazySmartsheetExpandedForm
      v-if="expandedFormOnRowIdDlg && meta?.id"
      v-model="expandedFormOnRowIdDlg"
      :row="expandedFormRow ?? { row: {}, oldRow: {}, rowMeta: {} }"
      :meta="meta"
      :load-row="!isPublic"
      :row-id="route.query.rowId"
      :first-row="isFirstRow"
      :last-row="isLastRow"
      :view="view"
      show-next-prev-icons
      :expand-form="expandForm"
      @next="navigateToSiblingRow(NavigateDir.NEXT)"
      @prev="navigateToSiblingRow(NavigateDir.PREV)"
    />
  </Suspense>
</template>

<style lang="scss" scoped>
.nc-gallery-container,
.nc-gallery-container-skeleton {
  @apply auto-rows-[1fr] grid-cols-[repeat(auto-fit,minmax(250px,1fr))];
}

:deep(.slick-dots li button) {
  @apply !bg-black;
}

.ant-carousel.gallery-carousel :deep(.slick-dots) {
  @apply !w-full max-w-[calc(100%_-_36%)] absolute left-0 right-0 bottom-[-18px] h-6 overflow-x-auto nc-scrollbar-thin !mx-auto;
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

:deep(.ant-card) {
  @apply transition-all duration-0.3s;

  box-shadow: 0px 2px 4px -2px rgba(0, 0, 0, 0.06), 0px 4px 4px -2px rgba(0, 0, 0, 0.02);

  &:hover {
    @apply !border-gray-300;
    box-shadow: 0px 0px 24px 0px rgba(0, 0, 0, 0.1), 0px 0px 8px 0px rgba(0, 0, 0, 0.04);

    .nc-action-icon {
      @apply invisible;
    }
  }
}

.nc-card-display-value-wrapper {
  @apply my-0 text-xl leading-8 text-gray-600;

  .nc-cell,
  .nc-virtual-cell {
    @apply text-xl leading-8;

    :deep(.nc-cell-field),
    :deep(input),
    :deep(textarea),
    :deep(.nc-cell-field-link) {
      @apply !text-xl leading-8 text-gray-600;

      &:not(.ant-select-selection-search-input) {
        @apply !text-xl leading-8 text-gray-600;
      }
    }
  }
}

.nc-card-col-wrapper {
  @apply !text-small !leading-[18px];

  .nc-cell,
  .nc-virtual-cell {
    @apply !text-small !leading-[18px];

    :deep(.nc-cell-field),
    :deep(input),
    :deep(textarea),
    :deep(.nc-cell-field-link) {
      @apply !text-small leading-[18px];

      &:not(.ant-select-selection-search-input) {
        @apply !text-small leading-[18px];
      }
    }
  }
}

.nc-card-col-header {
  :deep(.nc-cell-icon),
  :deep(.nc-virtual-cell-icon) {
    @apply ml-0 !w-3.5 !h-3.5;
  }
}

:deep(.nc-cell) {
  &.nc-cell-longtext {
    .long-text-wrapper {
      @apply min-h-1;
      .nc-readonly-rich-text-wrapper {
        @apply !min-h-1;
      }
      .nc-rich-text {
        @apply pl-0;
        .tiptap.ProseMirror {
          @apply -ml-1 min-h-1;
        }
      }
    }
  }
  &.nc-cell-checkbox {
    @apply children:pl-0;
  }
  &.nc-cell-singleselect .nc-cell-field > div {
    @apply flex items-center;
  }
  &.nc-cell-multiselect .nc-cell-field > div {
    @apply h-5;
  }
  &.nc-cell-email,
  &.nc-cell-phonenumber {
    @apply flex items-center;
  }

  &.nc-cell-email,
  &.nc-cell-phonenumber,
  &.nc-cell-url {
    .nc-cell-field-link {
      @apply py-0;
    }
  }
}

:deep(.nc-virtual-cell) {
  .nc-links-wrapper {
    @apply py-0 children:min-h-4;
  }
  &.nc-virtual-cell-linktoanotherrecord {
    .chips-wrapper {
      @apply min-h-4 !children:min-h-4;
      .chip.group {
        @apply my-0;
      }
    }
  }
  &.nc-virtual-cell-lookup {
    .nc-lookup-cell {
      &:has(.nc-attachment-wrapper) {
        @apply !h-auto;

        .nc-attachment-cell {
          @apply !h-auto;

          .nc-attachment-wrapper {
            @apply py-0;
          }
        }
      }
      &:not(:has(.nc-attachment-wrapper)) {
        @apply !h-5.5;
      }
      .nc-cell-lookup-scroll {
        @apply py-0 h-auto;
      }
    }
  }
  &.nc-virtual-cell-formula {
    .nc-cell-field {
      @apply py-0;
    }
  }

  &.nc-virtual-cell-qrcode,
  &.nc-virtual-cell-barcode {
    @apply children:justify-start;
  }
}
</style>
