<script lang="ts" setup>
import { ViewTypes, isVirtualCol } from 'nocodb-sdk'
import type { Row as RowType } from '#imports'

interface Attachment {
  url: string
}

const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())
const reloadViewMetaHook = inject(ReloadViewMetaHookInj)
const reloadViewDataHook = inject(ReloadViewDataHookInj)
const openNewRecordFormHook = inject(OpenNewRecordFormHookInj, createEventHook())
const isPublic = inject(IsPublicInj, ref(false))

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
  deleteRow,
  navigateToSiblingRow,
} = useViewData(meta, view, xWhere)

provide(IsFormInj, ref(false))
provide(IsGalleryInj, ref(true))
provide(IsGridInj, ref(false))
provide(IsCalendarInj, ref(false))

provide(RowHeightInj, ref(1 as const))

const fields = inject(FieldsInj, ref([]))

const route = useRoute()

const router = useRouter()

const { getPossibleAttachmentSrc } = useAttachment()

const { isMobileMode } = useGlobal()

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

// remove openNewRecordFormHookHandler before unmounting
// so that it won't be triggered multiple times
onBeforeUnmount(() => openNewRecordFormHook.off(openNewRecordFormHookHandler))

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
reloadViewDataHook?.on(async (params) => {
  await loadData({
    ...(params?.offset !== undefined ? { offset: params.offset } : {}),
  })
})

// provide view data reload hook as fallback to row data reload
provide(ReloadRowDataHookInj, reloadViewDataHook!)

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
  <NcDropdown
    v-model:visible="contextMenu"
    :trigger="isSqlView ? [] : ['contextmenu']"
    overlay-class-name="nc-dropdown-grid-context-menu"
  >
    <template #overlay>
      <NcMenu @click="contextMenu = false">
        <NcMenuItem v-if="contextMenuTarget" @click="expandForm(contextMenuTarget.row)">
          <div v-e="['a:row:expand-record']" class="flex items-center gap-2">
            <component :is="iconMap.expand" class="flex" />
            <!-- Expand Record -->
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
            <!-- Delete Row -->
            {{ $t('activity.deleteRow') }}
          </div>
        </NcMenuItem>

        <!--        <NcMenuItem v-if="contextMenuTarget" @click="openNewRecordFormHook.trigger()"> -->
        <!--          <div v-e="['a:row:insert']" class="flex items-center gap-2"> -->
        <!--            &lt;!&ndash; Insert New Row &ndash;&gt; -->
        <!--            {{ $t('activity.insertRow') }} -->
        <!--          </div> -->
        <!--        </NcMenuItem> -->
      </NcMenu>
    </template>

    <div
      class="flex flex-col w-full nc-gallery nc-scrollbar-md bg-gray-50"
      data-testid="nc-gallery-wrapper"
      :style="{ height: isMobileMode ? 'calc(100% - var(--topbar-height))' : 'calc(100% - var(--topbar-height) + 0.6rem)' }"
      :class="{
        '!overflow-hidden': isViewDataLoading,
      }"
    >
      <div v-if="isViewDataLoading" class="flex flex-col h-full">
        <div class="nc-gallery-container-skeleton grid gap-3 p-3">
          <a-skeleton-input v-for="index of Array(20)" :key="index" class="!min-w-60.5 !h-96 !rounded-md overflow-hidden" />
        </div>
      </div>
      <div v-else class="nc-gallery-container grid gap-3 p-3">
        <div v-for="(record, rowIndex) in data" :key="`record-${record.row.id}`">
          <LazySmartsheetRow :row="record">
            <a-card
              class="!rounded-xl h-full border-gray-200 border-1 group overflow-hidden break-all max-w-[450px] cursor-pointer"
              :body-style="{ padding: '16px !important' }"
              :data-testid="`nc-gallery-card-${record.row.id}`"
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
                      :key="`carousel-${record.row.id}-${index}`"
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
                <h2 v-if="displayField" class="nc-card-display-value-wrapper">
                  <template v-if="!isRowEmpty(record, displayField)">
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
                  :key="`record-${record.row.id}-${col.id}`"
                  :class="{
                    '!children:pointer-events-auto': isButton(col),
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
                      v-if="!isRowEmpty(record, col)"
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

        <template v-if="data.length <= 4">
          <div v-for="index of Array(8 - data.length)" :key="index" class="nc-empty-card"></div>
        </template>
      </div>
    </div>
  </NcDropdown>

  <LazySmartsheetPagination
    v-model:pagination-data="paginationData"
    align-count-on-right
    show-api-timing
    :change-page="changePage"
    class=""
  >
    <template #add-record>
      <NcButton v-if="isUIAllowed('dataInsert')" size="xs" type="secondary" class="ml-2" @click="openNewRecordFormHook.trigger">
        <div class="flex items-center gap-2">
          <component :is="iconMap.plus" class="" />

          {{ $t('activity.newRecord') }}
        </div>
      </NcButton>
    </template>
  </LazySmartsheetPagination>
  <Suspense>
    <LazySmartsheetExpandedForm
      v-if="expandedFormRow && expandedFormDlg"
      v-model="expandedFormDlg"
      :row="expandedFormRow"
      :load-row="!isPublic"
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
    }
  }
}

.nc-card-col-header {
  :deep(.nc-cell-icon),
  :deep(.nc-virtual-cell-icon) {
    @apply ml-0 !w-3.5 !h-3.5;
  }
}

:deep(.nc-cell),
:deep(.nc-virtual-cell) {
  @apply text-small leading-[18px];

  .nc-cell-field,
  input,
  textarea,
  .nc-cell-field-link {
    @apply !text-small !leading-[18px];
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
