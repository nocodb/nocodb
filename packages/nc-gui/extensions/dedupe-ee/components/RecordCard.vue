<script lang="ts" setup>
import type { Row as RowType } from '#imports'
import { type ColumnType, isVirtualCol } from 'nocodb-sdk'
import { useDedupeOrThrow } from '../lib/useDedupe'

interface Props {
  record: RowType
  isMergeRecord?: boolean
}

const props = withDefaults(defineProps<Props>(), {})

const { record } = toRefs(props)

const { currentGroup, selectedField, contextMenuTarget, mergeState, setPrimaryRecord, selectFieldValue, fields } =
  useDedupeOrThrow()

provide(IsFormInj, ref(false))
provide(IsGalleryInj, ref(true))
provide(IsGridInj, ref(false))
provide(IsCalendarInj, ref(false))
provide(RowHeightInj, ref(1 as const))

const isPrimaryRecord = computed(() => {
  return mergeState.value.primaryRecordIndex === record.value.rowMeta.rowIndex!
})

const showContextMenu = (e: MouseEvent, target?: { row: RowType; index: number }) => {
  if (props.isMergeRecord) return

  e.preventDefault()
  if (target) {
    contextMenuTarget.value = target
  }
}

const onClickMoreOption = (e: MouseEvent) => {
  if (props.isMergeRecord) return

  e.preventDefault()
  e.stopPropagation()

  const target = e.target as HTMLElement
  const rect = target.getBoundingClientRect()

  const clientX = rect.left
  const clientY = rect.bottom

  const contextEvent = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX,
    clientY,
  })

  e.target?.dispatchEvent(contextEvent)
}

const resetPointerEvent = (record: RowType, col: ColumnType) => {
  return isButton(col) || (isRowEmpty(record, col) && isAllowToRenderRowEmptyField(col)) || isVirtualCol(col)
}

const handleClick = () => {
  if (props.isMergeRecord) return

  if (!ncIsNumber(mergeState.value.primaryRecordIndex)) {
    setPrimaryRecord(record.value.rowMeta.rowIndex!)
  }
}

const handleClickField = (col: ColumnType) => {
  if (props.isMergeRecord) return

  if (!ncIsNumber(mergeState.value.primaryRecordIndex)) {
    setPrimaryRecord(record.value.rowMeta.rowIndex!)

    return
  }

  if (isVirtualCol(col)) return

  if (isPrimaryRecord.value && !ncIsUndefined(mergeState.value.selectedFields[col.id!])) {
    delete mergeState.value.selectedFields[col.id!]

    return
  }

  selectFieldValue(col.id!, record.value.rowMeta.rowIndex!)
}

const isFieldSelected = (col: ColumnType) => {
  if (props.isMergeRecord) return false

  if (ncIsUndefined(mergeState.value.selectedFields[col.id!])) {
    return mergeState.value.primaryRecordIndex === record.value.rowMeta.rowIndex!
  }

  return mergeState.value.selectedFields[col.id!] === record.value.rowMeta.rowIndex!
}
</script>

<template>
  <LazySmartsheetRow :row="record">
    <a-card
      class="!rounded-xl h-full !border-nc-border-gray-medium !bg-nc-bg-default border-1 group break-all w-[320px] max-w-[320px] flex-none flex flex-col relative"
      :body-style="{ padding: '0px !important', flex: 1, display: 'flex' }"
      :data-testid="`nc-gallery-card-${record.rowMeta.rowIndex}`"
      :style="{
        ...extractRowBackgroundColorStyle(record).rowBgColor,
        ...extractRowBackgroundColorStyle(record).rowBorderColor,
      }"
      :class="{
        'cursor-pointer': !isMergeRecord,
      }"
      @click="handleClick"
      @contextmenu="showContextMenu($event, { row: record, index: record.rowMeta.rowIndex })"
    >
      <template #cover>
        <div v-if="selectedField" class="p-2 rounded-t-xl border-1 bg-nc-bg-default">
          <div class="flex items-center gap-3">
            <div
              v-if="!ncIsNumber(mergeState.primaryRecordIndex)"
              class="border-1 rounded-md inline-flex items-center justify-center text-bodySm px-1 min-w-5 h-5 text-nc-content-gray-muted shadow-sm"
            >
              {{ record.rowMeta.rowIndex! + 1 }}
            </div>
            <div
              v-else
              class="h-5 w-5 flex items-center justify-center children:flex-none"
              :class="{
                'text-green-700': isPrimaryRecord || isMergeRecord,
                'text-red-700': !isPrimaryRecord && !isMergeRecord,
              }"
            >
              <GeneralIcon :icon="isPrimaryRecord || isMergeRecord ? 'circleCheckSolid' : 'close'" />
            </div>
            <NcTooltip class="truncate leading-[20px] flex-1" show-on-truncate-only>
              <template #title>
                <SmartsheetPlainCell
                  :model-value="currentGroup?.[selectedField.title!] ?? null"
                  :column="selectedField"
                  class="font-semibold leading-[20px]"
                />
              </template>

              <SmartsheetPlainCell
                :model-value="currentGroup?.[selectedField.title!] ?? null"
                :column="selectedField"
                class="font-semibold text-nc-content-brand leading-[20px]"
                :class="{
                  'line-through decoration-red-700':
                    ncIsNumber(mergeState.primaryRecordIndex) && !isPrimaryRecord && !isMergeRecord,
                }"
              />
            </NcTooltip>
            <NcButton v-if="!isMergeRecord" icon-only type="text" size="small" @click="onClickMoreOption($event)">
              <template #icon>
                <GeneralIcon icon="threeDotVertical" />
              </template>
            </NcButton>

            <div v-else class="h-8 w-8">&nbsp;</div>
          </div>
        </div>
      </template>

      <div class="flex-1 flex content-stretch gap-3 w-full overflow-hidden rounded-b-xl">
        <div class="flex-1 flex flex-col">
          <div
            v-for="(col, colIndex) of fields"
            :key="`record-${record.rowMeta.rowIndex}-${col.id}`"
            class="nc-card-col-wrapper p-2 !border-none min-h-15"
            :class="{
              'nc-field-selected': isFieldSelected(col) && !isMergeRecord && !isVirtualCol(col),
              '!cursor-not-allowed': isVirtualCol(col),
            }"
            @click="handleClickField(col)"
          >
            <NcTooltip
              hide-on-click
              :disabled="!isVirtualCol(col)"
              class="w-full z-10 flex"
              :class="{
                'pointer-events-none': !resetPointerEvent(record, col),
              }"
              placement="left"
              :arrow="false"
            >
              <template #title> Computed field can't be merged </template>
              <div class="flex flex-col rounded-lg w-full pointer-events-none">
                <div class="flex flex-row w-full justify-start">
                  <div class="nc-card-col-header w-full !children:text-gray-500">
                    <LazySmartsheetHeaderVirtualCell v-if="isVirtualCol(col)" :column="col" :hide-menu="true" />
                    <LazySmartsheetHeaderCell v-else :column="col" :hide-menu="true" />
                  </div>
                </div>
                <div
                  v-if="!isRowEmpty(record, col) || isAllowToRenderRowEmptyField(col)"
                  class="flex flex-row w-full text-nc-content-gray items-center justify-start min-h-7 py-1"
                >
                  <LazySmartsheetVirtualCell
                    v-if="isVirtualCol(col)"
                    v-model="record.row[col.title]"
                    :column="col"
                    :row="record"
                    class="!text-nc-content-gray"
                  />
                  <LazySmartsheetCell
                    v-else
                    v-model="record.row[col.title]"
                    :column="col"
                    :edit-enabled="false"
                    :read-only="true"
                    class="!text-nc-content-gray"
                  />
                </div>
                <div
                  v-else
                  class="flex flex-row w-full items-center justify-start"
                  :class="{
                    'h-8': isVirtualCol(col),
                    'h-7': !isVirtualCol(col),
                  }"
                >
                  -
                </div>
              </div>
            </NcTooltip>
          </div>
        </div>
      </div>
    </a-card>
  </LazySmartsheetRow>
</template>

<style lang="scss" scoped>
:deep(.ant-card) {
  @apply transition-all duration-0.3s;

  box-shadow: 0px 2px 4px -2px rgba(0, 0, 0, 0.06), 0px 4px 4px -2px rgba(0, 0, 0, 0.02);

  &:hover {
    @apply !border-nc-border-gray-dark;
    box-shadow: 0px 0px 24px 0px rgba(0, 0, 0, 0.1), 0px 0px 8px 0px rgba(0, 0, 0, 0.04);

    .nc-action-icon {
      @apply invisible;
    }
  }
}

:deep(.ant-card-cover) {
  @apply sticky top-0 z-100 bg-nc-bg-gray-extralight;
}

.nc-card-display-value-wrapper {
  @apply my-0 text-xl leading-8 text-nc-content-gray-subtle2;

  .nc-cell,
  .nc-virtual-cell {
    @apply text-xl leading-8;

    :deep(.nc-cell-field),
    :deep(input),
    :deep(textarea),
    :deep(.nc-cell-field-link) {
      @apply !text-xl leading-8 text-nc-content-gray-subtle2;

      &:not(.ant-select-selection-search-input) {
        @apply !text-xl leading-8 text-nc-content-gray-subtle2;
      }
    }
  }
}

.nc-card-col-wrapper {
  @apply !text-small !leading-[18px];

  &:not(.nc-field-selected) {
    @apply hover:bg-nc-bg-gray-extralight;
  }

  &.nc-field-selected {
    @apply bg-nc-green-100 dark:bg-nc-green-50 hover:bg-opacity-80;
  }

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
  &.nc-cell-datetime {
    @apply !w-auto;
    & > div {
      @apply !w-auto;
    }
    div {
      @apply flex-none !max-w-none !w-auto;
    }
  }

  .nc-date-picker > div > div {
    &:first-child {
      @apply pl-0;
    }

    &:last-child {
      @apply pr-0;
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

  .nc-date-picker > div > div {
    &:first-child {
      @apply pl-0;
    }

    &:last-child {
      @apply pr-0;
    }
  }
}

.nc-record-cell-tooltip {
  @apply !bg-transparent !hover:bg-transparent;

  :deep(.nc-cell-icon) {
    @apply !ml-0 h-3.5 w-3.5;
  }
  :deep(.name) {
    @apply text-captionSm;
  }

  :deep(.nc-cell-name-wrapper),
  :deep(.nc-virtual-cell-name-wrapper) {
    @apply !max-w-full;
  }
}
</style>
