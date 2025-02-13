<script setup lang="ts">
import type { ComputedRef } from 'vue'
import { type ColumnType, isVirtualCol } from 'nocodb-sdk'
import { IsCanvasInjectionInj } from '../../../context'
import JsBarcodeWrapper from './JsBarcodeWrapper.vue'

const isCanvasInjected = inject(IsCanvasInjectionInj, false)
const isUnderLookup = inject(IsUnderLookupInj, ref(false))

const maxNumberOfAllowedCharsForBarcodeValue = 100

const cellValue = inject(CellValueInj)

const column = inject(ColumnInj)

const barcodeValue: ComputedRef<string> = computed(() => String(cellValue?.value ?? ''))

const meta = inject(MetaInj)
const valueFieldId = computed(() => column?.value.colOptions?.fk_barcode_value_column_id)

const tooManyCharsForBarcode = computed(() => barcodeValue.value.length > maxNumberOfAllowedCharsForBarcodeValue)

const modalVisible = ref(false)

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))

const barcodeMeta = computed(() => {
  return {
    barcodeFormat: 'CODE128',
    ...parseProp(column?.value?.meta),
  }
})

const handleModalOkClick = () => (modalVisible.value = false)

const showBarcode = computed(
  () => barcodeValue?.value.length > 0 && !tooManyCharsForBarcode.value && barcodeValue?.value !== 'ERR!',
)

const showBarcodeModal = () => {
  if (!showBarcode.value) return
  modalVisible.value = true
}

const { showClearNonEditableFieldWarning } = useShowNotEditableWarning({ onEnter: showBarcodeModal })

const rowHeight = inject(RowHeightInj, ref(undefined))

const height = computed(() => {
  if (isExpandedFormOpen.value) {
    return '44px'
  }

  if (!rowHeight.value) {
    return '1.8rem'
  }

  return `${rowHeight.value === 1 ? rowHeightInPx['1']! - 4 : rowHeightInPx[`${rowHeight.value}`]! - 20}px`
})

const cellIcon = (column: ColumnType) =>
  h(isVirtualCol(column) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: column,
  })

onMounted(() => {
  if (isCanvasInjected && !isUnderLookup.value && !isExpandedFormOpen.value) {
    modalVisible.value = true
  }
})
</script>

<template>
  <a-modal
    v-model:visible="modalVisible"
    :class="{ active: modalVisible }"
    wrap-class-name="nc-barcode-large barcode-modal"
    :body-style="{ padding: '0px' }"
    :footer="null"
    :closable="false"
    @ok="handleModalOkClick"
  >
    <template #title>
      <div class="flex gap-2 items-center w-full">
        <h1 class="font-weight-700 m-0">{{ column?.title }}</h1>
        <div class="h-5 px-1 bg-nc-bg-gray-medium text-nc-content-gray-subtle2 rounded-md justify-center items-center flex">
          <component :is="cellIcon(meta?.columnsById?.[valueFieldId])" class="h-4" />
          <div class="text-sm font-medium">{{ meta?.columnsById?.[valueFieldId]?.title }}</div>
        </div>
        <div class="flex-1"></div>
        <NcButton class="nc-barcode-close !px-1" type="text" size="xs" @click="modalVisible = false">
          <GeneralIcon class="text-md text-gray-700 h-4 w-4" icon="close" />
        </NcButton>
      </div>
    </template>
    <JsBarcodeWrapper
      v-if="showBarcode"
      :barcode-value="barcodeValue"
      :barcode-format="barcodeMeta.barcodeFormat"
      show-download
    />
  </a-modal>
  <div
    v-if="!tooManyCharsForBarcode"
    class="flex w-full items-center barcode-wrapper"
    :class="{
      'justify-start': isExpandedFormOpen,
      'justify-center': !isExpandedFormOpen,
    }"
  >
    <JsBarcodeWrapper
      v-if="showBarcode && rowHeight"
      :barcode-value="barcodeValue"
      tabindex="-1"
      :barcode-format="barcodeMeta.barcodeFormat"
      :custom-style="{
        height,
      }"
      class="nc-barcode-container"
      @on-click-barcode="showBarcodeModal"
    >
      <template #barcodeRenderError>
        <div class="text-left text-wrap mt-2 text-[#e65100] text-xs" data-testid="barcode-invalid-input-message">
          {{ $t('msg.warning.barcode.renderError') }}
        </div>
      </template>
    </JsBarcodeWrapper>
    <JsBarcodeWrapper
      v-else-if="showBarcode"
      tabindex="-1"
      :barcode-value="barcodeValue"
      :barcode-format="barcodeMeta.barcodeFormat"
      class="nc-barcode-container"
      @on-click-barcode="showBarcodeModal"
    >
      <template #barcodeRenderError>
        <div class="text-left text-wrap mt-2 text-[#e65100] text-xs" data-testid="barcode-invalid-input-message">
          {{ $t('msg.warning.barcode.renderError') }}
        </div>
      </template>
    </JsBarcodeWrapper>
    <a-tooltip v-else-if="!showBarcode && barcodeValue === 'ERR!'" placement="bottom" class="text-orange-700">
      <template #title>
        <span class="font-bold">Please select a target field!</span>
      </template>
      <span>ERR!</span>
    </a-tooltip>
  </div>

  <div v-if="tooManyCharsForBarcode" class="nc-cell-field text-left text-wrap text-[#e65100] text-xs">
    {{ $t('labels.barcodeValueTooLong') }}
  </div>
  <div v-if="showClearNonEditableFieldWarning" class="nc-cell-field text-left text-wrap mt-2 text-[#e65100] text-xs">
    {{ $t('msg.warning.nonEditableFields.barcodeFieldsCannotBeDirectlyChanged') }}
  </div>
</template>

<style lang="scss" scoped>
.barcode-wrapper {
  & > div {
    @apply max-w-8.2rem;
  }
}
</style>

<style lang="scss">
.barcode-modal .ant-modal-content {
  padding: 0 !important;
  .ant-modal-header {
    position: relative;
    padding: 8px 16px;
    border-top-left-radius: 1em;
    border-top-right-radius: 1em;
    border-bottom: 1px solid #e7e7e9;
    .ant-modal-title {
      height: 30px;
      display: flex;
      align-items: center;
    }
  }
}

.nc-data-cell {
  &:has(.nc-virtual-cell-barcode) {
    @apply !border-none;
    box-shadow: none !important;

    &:focus-within:not(.nc-readonly-div-data-cell):not(.nc-system-field) {
      box-shadow: none !important;
    }
  }
}
</style>
