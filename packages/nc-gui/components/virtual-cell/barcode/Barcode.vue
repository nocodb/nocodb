<script setup lang="ts">
import type { ComputedRef } from 'vue'
import { type ColumnType, isVirtualCol } from 'nocodb-sdk'
import JsBarcodeWrapper from './JsBarcodeWrapper.vue'

const maxNumberOfAllowedCharsForBarcodeValue = 100

const cellValue = inject(CellValueInj)

const column = inject(ColumnInj)

const barcodeValue: ComputedRef<string> = computed(() => String(cellValue?.value ?? ''))

const { metaColumnById } = useViewColumnsOrThrow()
const valueFieldId = computed(() => column?.value.colOptions?.fk_barcode_value_column_id)

const tooManyCharsForBarcode = computed(() => barcodeValue.value.length > maxNumberOfAllowedCharsForBarcodeValue)

const modalVisible = ref(false)

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))

const showBarcodeModal = () => {
  modalVisible.value = true
}

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

const { showClearNonEditableFieldWarning } = useShowNotEditableWarning({ onEnter: showBarcodeModal })

const rowHeight = inject(RowHeightInj, ref(undefined))
const cellIcon = (column: ColumnType) =>
  h(isVirtualCol(column) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: column,
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
        <div class="h-5 px-1 bg-[#e7e7e9] rounded-md justify-center items-center flex">
          <component :is="cellIcon(metaColumnById?.[valueFieldId])" class="h-4" />
          <div class="text-[#4a5268] text-sm font-medium">{{ metaColumnById?.[valueFieldId]?.title }}</div>
        </div>
        <div class="flex-1"></div>
        <NcButton
          class="nc-expand-form-close-btn !w-7 !h-7"
          data-testid="nc-expanded-form-close"
          type="text"
          size="xsmall"
          @click="modalVisible = false"
        >
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
      'justify-start ml-2': isExpandedFormOpen,
      'justify-center': !isExpandedFormOpen,
    }"
  >
    <JsBarcodeWrapper
      v-if="showBarcode && rowHeight"
      :barcode-value="barcodeValue"
      tabindex="-1"
      :barcode-format="barcodeMeta.barcodeFormat"
      :custom-style="{
        height: rowHeight ? `${rowHeight === 1 ? rowHeightInPx['1'] - 4 : rowHeightInPx[`${rowHeight}`] - 20}px` : `1.8rem`,
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
</style>
