<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { type TableType } from 'nocodb-sdk'
import type { EventHook } from '@vueuse/core'
import PageEditor from './components/PageEditor.vue'
import { type PageDesignerPayload } from './lib/payload'
import { PageDesignerLayout, PageOrientation, PageType } from './lib/layout'
import { PageDesignerEventHookInj, PageDesignerPayloadInj, PageDesignerRowInj, PageDesignerTableTypeInj } from './lib/context'
import TableAndViewPicker from './components/TableAndViewPicker.vue'
import RecordSelector from './components/RecordSelector.vue'

const KV_STORE_KEY = 'pageDesigner'

const { extension, fullscreen, getTableMeta, activeTableId, activeViewId, getViewsForTable } = useExtensionHelperOrThrow()

const eventHook = createEventHook<'previousRecord' | 'nextRecord'>()

const { base } = storeToRefs(useBase())

provide(PageDesignerEventHookInj, eventHook)
provide(IsPageDesignerExtensionActiveInj, true)

const savedPayload = ref<PageDesignerPayload>({
  widgets: {},
  orientation: PageOrientation.PORTRAIT,
  pageType: PageType.LETTER,
  lastWidgetId: 0,
  currentWidgetId: -1,
  isPreviewMode: false,
})

const { viewsByTable } = storeToRefs(useViewsStore())

const row = ref<Row>()
const meta = ref<TableType>()

const viewMeta = computed(() =>
  viewsByTable.value.get(savedPayload.value.selectedTableId ?? '')?.find((view) => view.id === savedPayload.value.selectedViewId),
)
const displayField = computed(() => meta.value?.columns?.find((c) => c?.pv) || meta.value?.columns?.[0] || null)
const { cachedRows, loadData } = useInfiniteData({
  meta,
  viewMeta,
  callbacks: {},
})

provide(PageDesignerPayloadInj, savedPayload)
provide(PageDesignerRowInj, row)
provide(PageDesignerTableTypeInj, meta)

async function saveChanges() {
  await extension.value.kvStore.set(KV_STORE_KEY, savedPayload.value)
}

watch(
  [
    () => {
      const { selectedTableId, selectedViewId } = savedPayload.value
      return { selectedTableId, selectedViewId }
    },
    meta,
    viewMeta,
  ],
  async () => {
    if (row.value || !meta.value || !viewMeta.value || meta.value.id !== savedPayload.value.selectedTableId) return

    const rows = await loadData()
    if (rows.length) {
      row.value = rows[0]
      rows.forEach((row) => cachedRows.value.set(row.rowMeta.rowIndex, row))
    }
  },
)

async function loadRecordAtIndex(index: number) {
  const rows = await loadData({ offset: index })
  if (!rows.length) return

  rows.forEach((row) => cachedRows.value.set(row.rowMeta.rowIndex, row))
  return rows[0]
}

async function onEventHookTrigger(event: typeof eventHook extends EventHook<infer U> ? U : never) {
  const currentRowIdx = row.value?.rowMeta.rowIndex ?? 0
  if (event === 'nextRecord') {
    const nextIndex = currentRowIdx + 1
    if (cachedRows.value.has(nextIndex)) row.value = cachedRows.value.get(nextIndex)
    else {
      const newRow = await loadRecordAtIndex(nextIndex)
      if (newRow) row.value = newRow
    }
  } else if (event === 'previousRecord' && currentRowIdx > 0) {
    const previousIndex = currentRowIdx - 1
    if (cachedRows.value.has(previousIndex)) row.value = cachedRows.value.get(previousIndex)
  }
}

watch(
  () => {
    return {
      selectedTableId: savedPayload.value.selectedTableId,
      selectedViewId: savedPayload.value.selectedViewId,
      pageName: savedPayload.value.pageName,
      widgets: savedPayload.value.widgets,
      orientation: savedPayload.value.orientation,
      pageType: savedPayload.value.pageType,
    }
  },
  () => {
    saveChanges()
  },
  { deep: true },
)

watch(
  () => savedPayload.value.selectedTableId,
  async (tableId) => {
    if (!tableId) return
    row.value = undefined
    const tableMeta = await getTableMeta(tableId)
    if (tableMeta) meta.value = tableMeta
  },
  {
    immediate: true,
  },
)

watch(
  () => {
    const { orientation, pageType } = savedPayload.value
    return {
      orientation,
      pageType,
    }
  },
  ({ orientation, pageType }) => {
    let { width, height } = PageDesignerLayout.PageSizesByType[pageType]
    if (orientation === PageOrientation.LANDSCAPE) {
      ;[width, height] = [height, width]
    }
    useStyleTag(
      `
      @page {
        size: ${width}in ${height}in !important;
        margin: 0 !important;
      }`,
      { media: 'print', id: 'printStyle' },
    )
  },
)

async function tryInitializeTableAndView() {
  if (!savedPayload.value.selectedTableId) {
    savedPayload.value.selectedTableId = activeTableId.value ?? ''
  }

  if (!savedPayload.value.selectedViewId) {
    const views = await getViewsForTable(savedPayload.value.selectedTableId)
    savedPayload.value.selectedViewId = views.find((view) => view.is_default)?.id ?? activeViewId.value ?? ''
  }
}

onMounted(async () => {
  const saved = (await extension.value.kvStore.get(KV_STORE_KEY)) as PageDesignerPayload
  if (saved) {
    savedPayload.value = saved
    savedPayload.value.currentWidgetId = -1
  }
  tryInitializeTableAndView()
  eventHook.on(onEventHookTrigger)
})

onUnmounted(() => {
  eventHook.off(onEventHookTrigger)
})

// change the document title while printing and reset it after
let previousTitle = document.title
useEventListener('beforeprint', () => {
  previousTitle = document.title
  const baseName = base.value.title ?? ''
  const prefix = savedPayload.value.pageName || `${baseName}/${meta.value?.title || ''}`
  const recordDisplayName = row.value?.row[displayField.value?.title ?? ''] ?? ''
  document.title = `${prefix}${recordDisplayName ? ` - ${recordDisplayName}` : ''}`
})
useEventListener('afterprint', () => {
  document.title = previousTitle
})
</script>

<template>
  <ExtensionsExtensionWrapper class="page-designer" @header-click="savedPayload.currentWidgetId = -1">
    <template v-if="fullscreen" #headerExtra>
      <!-- <NcButton> Header actions </NcButton> -->
    </template>
    <div class="flex flex-col h-full">
      <div v-if="!fullscreen" class="flex flex-col max-h-full">
        <div class="p-3 flex">
          <TableAndViewPicker />
        </div>
        <div class="px-3 flex">
          <RecordSelector />
        </div>
        <div class="overflow-y-auto flex-1 relative group mt-3 mini-layout">
          <div
            class="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out transform -translate-x-2/4 -translate-y-2/4 left-2/4 top-2/4"
            style="z-index: 10000"
          >
            <NcButton @click="fullscreen = true">
              <template #icon>
                <GeneralIcon icon="ncEdit"></GeneralIcon>
              </template>
              Edit Layout
            </NcButton>
          </div>
          <PageEditor mini-preview />
        </div>
      </div>
      <PageEditor v-else />
    </div>
  </ExtensionsExtensionWrapper>
</template>

<style lang="scss">
.page-designer {
  .ant-select-selector,
  .ant-input,
  .ant-input-affix-wrapper {
    &:hover:not(:focus):not(:focus-within) {
      @apply !bg-nc-bg-gray-extralight;
    }
  }
  .ant-input-affix-wrapper:hover .ant-input {
    @apply bg-nc-bg-gray-extralight;
  }
  .field-search {
    &,
    &:hover {
      .ant-input-affix-wrapper,
      .ant-input {
        &,
        &:hover {
          @apply !bg-nc-bg-default;
        }
      }
    }
  }
  label {
    @apply font-500 text-nc-content-gray;
  }
  .page-widget {
    & > .absolute {
      outline: 2px solid #ddd;
      transition: outline 200ms ease-in-out;
      @apply rounded-[2px];
      cursor: grab !important;
      &:active {
        cursor: grabbing !important;
      }
    }
    &:hover {
      > .absolute {
        outline: 2px solid gray;
      }
    }
    &.active-page-widget {
      & > .absolute {
        outline: 2px solid #3366ff;
      }
      .moveable-removable {
        @apply flex;
      }
    }
  }
  .mini-layout {
    .grid-lines {
      @apply hidden;
    }
    .page-widget {
      @apply pointer-events-none;
      > .absolute {
        outline: none !important;
      }
    }
  }
  .page-widget:not(.active-page-widget) {
    .moveable-control,
    .moveable-rotation-line {
      @apply invisible;
    }
  }
  .nc-moveable .moveable-removable {
    @apply hidden;
  }
  .nc-moveable .moveable-line {
    @apply bg-transparent;
  }
  .nc-moveable .moveable-rotation {
    .moveable-rotation-line {
      @apply bg-nc-fill-primary w-[2px] -ml-[0.5px];
    }
    .moveable-rotation-control {
      @apply !border-nc-border-brand;
    }
  }
  .nc-moveable .moveable-control:not(.moveable-rotation-control) {
    @apply rounded-[3px] w-[10px] h-[10px] border-2 border-solid border-nc-border-brand bg-nc-bg-default -mt-[5px] -ml-[5px];
  }

  .radio-pills {
    @apply rounded-lg;
    label.ant-radio-button-wrapper {
      @apply bg-nc-bg-gray-light !border-t-nc-border-gray-light !border-b-nc-border-gray-light !border-l-nc-border-gray-light !border-r-nc-border-gray-medium;
      @apply px-2 text-nc-content-gray-subtle;
      &.ant-radio-button-wrapper-checked {
        @apply !outline-none !shadow-none !text-nc-content-brand-disabled;
      }
      &:before {
        @apply !bg-transparent;
      }
    }
    > :first-child {
      @apply rounded-[8px_0_0_8px] !border-l-0;
    }
    > :last-child {
      @apply rounded-[0_8px_8px_0] !border-r-0;
    }
    > :hover {
      @apply !bg-nc-bg-gray-medium;
    }
    .nc-icon {
      @apply -mt-[2px];
    }
  }

  .border-inputs {
    .ant-input {
      @apply !rounded-lg h-8 w-8 text-center p-[2px];

      -moz-appearance: textfield; /*For FireFox*/

      &::-webkit-inner-spin-button {
        /*For Webkits like Chrome and Safari*/
        -webkit-appearance: none;
        @apply m-0;
      }
    }
  }

  .ant-input-affix-wrapper .ant-input {
    @apply !shadow-none;
  }
  .ant-select-selector,
  .ant-input,
  .ant-input-affix-wrapper {
    @apply !rounded-lg !border-nc-border-gray-medium;
    box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08) !important;
    &:focus,
    &:focus-within {
      @apply !border-nc-border-brand;
      box-shadow: 0px 0px 0px 2px rgba(51, 102, 255, 0.24) !important;
    }
  }
  .properties-panel {
    .ant-select-selection-item {
      @apply !inline-block;
    }
    .widget-header {
      @apply p-4 border-b border-solid border-nc-border-gray-medium;
      h1 {
        @apply text-[18px] font-700 leading-8 tracking-[-0.4px];
      }
    }
  }

  #printPage.nc-page-preview-mode {
    * {
      -webkit-print-color-adjust: exact; /* Chrome, Safari 6 – 15.3, Edge */
      color-adjust: exact; /* Firefox 48 – 96 */
      print-color-adjust: exact;
    }

    .print-hide,
    .grid-lines,
    .nc-moveable {
      @apply !hidden;
    }
    .page-widget > .absolute {
      outline: none !important;
    }
  }
}

@media print {
  * {
    -webkit-print-color-adjust: exact; /* Chrome, Safari 6 – 15.3, Edge */
    color-adjust: exact; /* Firefox 48 – 96 */
    print-color-adjust: exact;
  }
  .print-hide,
  .grid-lines,
  .nc-moveable {
    @apply !hidden;
  }
  .page-widget > .absolute {
    outline: none !important;
  }
  #printPage {
    @apply m-0 shadow-none visible absolute left-0 top-0;
  }
  body {
    @apply invisible;
  }
}
</style>
