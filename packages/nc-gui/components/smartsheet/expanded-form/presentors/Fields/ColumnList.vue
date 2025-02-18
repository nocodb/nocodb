<script setup lang="ts">
import { type ColumnType, isLinksOrLTAR, isVirtualCol } from 'nocodb-sdk'

const props = defineProps<{
  fields: ColumnType[]
  forceVerticalMode?: boolean
  isLoading: boolean
  showColCallback?: (col: ColumnType) => boolean
}>()

const { changedColumns, isNew, loadRow: _loadRow, row: _row } = useExpandedFormStoreOrThrow()
const isPublic = inject(IsPublicInj, ref(false))

const { isUIAllowed } = useRoles()

const readOnly = computed(() => !isUIAllowed('dataEdit') || isPublic.value)

const shouldApplyDataCell = (column: ColumnType) =>
  !(isBarcode(column) || isQrCode(column) || isBoolean(column) || isRating(column))

const showCol = (col: ColumnType) => {
  return props.showColCallback?.(col) || !isVirtualCol(col) || !isNew.value || isLinksOrLTAR(col)
}
</script>

<template>
  <div
    v-for="col of fields"
    v-show="showCol(col)"
    :key="col.title"
    :class="`nc-expand-col-${col.title}`"
    :col-id="col.id"
    :data-testid="`nc-expand-col-${col.title}`"
    class="nc-expanded-form-row w-full"
  >
    <div
      class="flex items-start nc-expanded-cell min-h-[32px]"
      :class="{
        'flex-row sm:(gap-x-2) <lg:(flex-col w-full)': !props.forceVerticalMode,
        'flex-col w-full': props.forceVerticalMode,
      }"
    >
      <div
        class="flex-none flex items-center rounded-lg overflow-hidden"
        :class="{
          'w-45 <lg:(w-full px-0 mb-1) h-[32px] xs:(h-auto)': !props.forceVerticalMode,
          'w-full px-0 mb-1 h-auto': props.forceVerticalMode,
        }"
      >
        <LazySmartsheetHeaderVirtualCell
          v-if="isVirtualCol(col)"
          :column="col"
          class="nc-expanded-cell-header h-full flex-none"
        />
        <LazySmartsheetHeaderCell v-else :column="col" class="nc-expanded-cell-header flex-none" />
      </div>

      <a-skeleton-input
        v-if="isLoading"
        active
        class="h-8 flex-none <lg:!w-full lg:flex-1 !rounded-lg !overflow-hidden"
        size="small"
      />
      <NcTooltip
        v-else
        class="<lg:(!w-full !flex-none) lg:flex-1 flex"
        :class="{
          'w-full !flex-none': props.forceVerticalMode,
          'lg:max-w-[calc(100%_-_188px)]': !props.forceVerticalMode,
        }"
        placement="right"
        :disabled="!isReadOnlyVirtualCell(col) || !shouldApplyDataCell(col)"
      >
        <template #title>{{ $t('msg.info.fieldReadonly') }}</template>
        <SmartsheetDivDataCell
          v-if="col.title"
          class="flex-1 bg-white px-1 min-h-8 flex items-center relative"
          :class="{
            'w-full': props.forceVerticalMode,
            '!select-text nc-system-field bg-nc-bg-gray-extralight !text-nc-content-inverted-primary-disabled cursor-pointer':
              isReadOnlyVirtualCell(col) && shouldApplyDataCell(col),
            '!select-text nc-readonly-div-data-cell': readOnly,
          }"
        >
          <LazySmartsheetVirtualCell
            v-if="isVirtualCol(col)"
            v-model="_row.row[col.title]"
            :column="col"
            :read-only="readOnly"
            :row="_row"
          />

          <LazySmartsheetCell
            v-else
            v-model="_row.row[col.title]"
            :active="true"
            :column="col"
            :edit-enabled="true"
            :read-only="readOnly"
            @update:model-value="changedColumns.add(col.title)"
          />
        </SmartsheetDivDataCell>
      </NcTooltip>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.ant-select-selector) {
  @apply !xs:(h-full);
}

.nc-data-cell {
  @apply !rounded-lg;
  transition: all 0.3s;

  &:not(.nc-readonly-div-data-cell):not(.nc-system-field):not(.nc-attachment-cell):not(.nc-virtual-cell-button) {
    box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08);
  }
  &:not(:focus-within):hover:not(.nc-readonly-div-data-cell):not(.nc-system-field):not(.nc-virtual-cell-button) {
    @apply !border-1;
    &:not(.nc-attachment-cell):not(.nc-virtual-cell-button) {
      box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.24);
    }
  }

  .nc-cell,
  .nc-virtual-cell {
    @apply h-auto;
  }

  &.nc-readonly-div-data-cell,
  &.nc-system-field {
    @apply !border-gray-200;

    .nc-cell,
    .nc-virtual-cell {
      @apply text-gray-400;
    }
  }
  &.nc-readonly-div-data-cell:focus-within,
  &.nc-system-field:focus-within {
    @apply !border-gray-200;
  }

  &:focus-within:not(.nc-readonly-div-data-cell):not(.nc-system-field) {
    @apply !shadow-selected;
  }

  &:has(.nc-virtual-cell-qrcode .nc-qrcode-container),
  &:has(.nc-virtual-cell-barcode .nc-barcode-container) {
    @apply !border-none px-0 !rounded-none;
    :deep(.nc-virtual-cell-qrcode),
    :deep(.nc-virtual-cell-barcode) {
      @apply px-0;
      & > div {
        @apply !px-0;
      }
      .barcode-wrapper {
        @apply ml-0;
      }
    }
    :deep(.nc-virtual-cell-qrcode) {
      img {
        @apply !h-[84px] border-1 border-solid border-gray-200 rounded;
      }
    }
    :deep(.nc-virtual-cell-barcode) {
      .nc-barcode-container {
        @apply border-1 rounded-lg border-gray-200 h-[64px] max-w-full p-2;
        svg {
          @apply !h-full;
        }
      }
    }
  }

  .nc-cell-json {
    @apply;
  }
}

.nc-mentioned-cell {
  box-shadow: 0px 0px 0px 2px var(--ant-primary-color-outline) !important;
  @apply !border-brand-500 !border-1;
}

.nc-data-cell:focus-within {
  @apply !border-1 !border-brand-500;
}

:deep(.nc-system-field input) {
  @apply bg-transparent;
}
:deep(.nc-data-cell .nc-cell .nc-cell-field) {
  @apply px-2;
}
:deep(.nc-data-cell .nc-virtual-cell .nc-cell-field) {
  @apply px-2;
}
:deep(.nc-data-cell .nc-cell-field.nc-lookup-cell .nc-cell-field) {
  @apply px-0;
}
</style>
