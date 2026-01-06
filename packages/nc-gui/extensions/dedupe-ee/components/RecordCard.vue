<script lang="ts" setup>
import type { Row as RowType } from '#imports'
import { type ColumnType, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import { useDedupeOrThrow } from '../lib/useDedupe'
import type { NumberDecimal } from 'ant-design-vue/lib/input-number/src/utils/MiniDecimal'

interface Props {
  record: RowType
}

const props = withDefaults(defineProps<Props>(), {})

const { record } = toRefs(props)

const {
  currentGroupRecords,
  currentGroupIndex,
  currentGroup,
  selectedField,
  contextMenuTarget,
  meta,
  mergeState,
  setPrimaryRecord,
  selectFieldValue,
} = useDedupeOrThrow()

provide(IsFormInj, ref(false))
provide(IsGalleryInj, ref(true))
provide(IsGridInj, ref(false))
provide(IsCalendarInj, ref(false))
provide(RowHeightInj, ref(1 as const))

const fields = computed(() => {
  return meta.value?.columns
    ?.filter((col) => {
      if (isSystemColumn(col) || col.id === selectedField.value?.id) return false
      return true
    })
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
})

const showContextMenu = (e: MouseEvent, target?: { row: RowType; index: number }) => {
  e.preventDefault()
  if (target) {
    contextMenuTarget.value = target
  }
}

const resetPointerEvent = (record: RowType, col: ColumnType) => {
  return isButton(col) || (isRowEmpty(record, col) && isAllowToRenderRowEmptyField(col))
}

const handleClick = () => {
  if (!ncIsNumber(mergeState.value.primaryRecordIndex)) {
    setPrimaryRecord(record.value.rowMeta.rowIndex!)
  }
}

const handleClickField = (col: ColumnType) => {
  if (!ncIsNumber(mergeState.value.primaryRecordIndex)) {
    setPrimaryRecord(record.value.rowMeta.rowIndex!)

    return
  }

  if (
    mergeState.value.primaryRecordIndex === record.value.rowMeta.rowIndex! &&
    !ncIsUndefined(mergeState.value.selectedFields[col.id!])
  ) {
    delete mergeState.value.selectedFields[col.id!]

    // mergeState.value = { ...mergeState.value }

    return
  }

  console.log('select field', col.id!, record.value.rowMeta.rowIndex!)

  selectFieldValue(col.id!, record.value.rowMeta.rowIndex!)
}

const isFieldSelected = (col: ColumnType) => {
  if (ncIsUndefined(mergeState.value.selectedFields[col.id!])) {
    return mergeState.value.primaryRecordIndex === record.value.rowMeta.rowIndex!
  }

  return mergeState.value.selectedFields[col.id!] === record.value.rowMeta.rowIndex!
}

watchEffect(() => {
  console.log('merge ', mergeState.value)
})
</script>

<template>
  <LazySmartsheetRow :row="record">
    <a-card
      class="!rounded-xl h-full !border-nc-border-gray-medium !bg-nc-bg-default border-1 group break-all w-[320px] max-w-[320px] flex-none cursor-pointer flex flex-col"
      :body-style="{ padding: '0px !important', flex: 1, display: 'flex' }"
      :data-testid="`nc-gallery-card-${record.rowMeta.rowIndex}`"
      :style="{
        ...extractRowBackgroundColorStyle(record).rowBgColor,
        ...extractRowBackgroundColorStyle(record).rowBorderColor,
      }"
      @click="handleClick"
      @contextmenu="showContextMenu($event, { row: record, index: record.rowMeta.rowIndex })"
    >
      <template #cover>
        <div v-if="selectedField" class="sticky top-0 z-10 px-2 py-3 border-b border-b-nc-border-gray-medium">
          <div class="flex items-center gap-3">
            <div
              class="border-1 rounded-md inline-flex items-center justify-center text-bodySm px-1 min-w-5 h-5 text-nc-content-gray-muted shadow-sm"
            >
              {{ record.rowMeta.rowIndex! + 1 }}
            </div>
            <NcTooltip class="truncate leading-[20px]" show-on-truncate-only>
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
              />
            </NcTooltip>
          </div>
        </div>
      </template>

      <div class="flex-1 flex content-stretch gap-3 w-full">
        <div class="flex-1 flex flex-col">
          <div
            v-for="col in fields"
            :key="`record-${record.rowMeta.rowIndex}-${col.id}`"
            class="nc-card-col-wrapper p-2 !border-none"
            :class="{
              'nc-field-selected ant-alert-success': isFieldSelected(col),
            }"
            @click="handleClickField(col)"
          >
            <NcTooltip
              hide-on-click
              :disabled="!isVirtualCol(col)"
              class="w-full z-10 flex pointer-events-none"
              placement="left"
              :arrow="false"
            >
              <template #title> Computed field can't be merged </template>
              <div
                class="flex flex-col rounded-lg w-full"
                :class="{
                  'pointer-events-none': !resetPointerEvent(record, col),
                }"
              >
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
                <div v-else class="flex flex-row w-full h-7 items-center justify-start">-</div>
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
