<script setup lang="ts">
import type { ComputedRef } from 'vue'
import JsBarcodeWrapper from './JsBarcodeWrapper.vue'

const maxNumberOfAllowedCharsForBarcodeValue = 100

const cellValue = inject(CellValueInj)

const column = inject(ColumnInj)

const barcodeValue: ComputedRef<string> = computed(() => String(cellValue?.value ?? ''))

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

const { showEditNonEditableFieldWarning, showClearNonEditableFieldWarning } = useShowNotEditableWarning()

const rowHeight = inject(RowHeightInj, ref(undefined))
</script>

<template>
  <a-modal
    v-model:visible="modalVisible"
    :class="{ active: modalVisible }"
    wrap-class-name="nc-barcode-large"
    :body-style="{ padding: '0px' }"
    :footer="null"
    @ok="handleModalOkClick"
  >
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
  <div v-if="showEditNonEditableFieldWarning" class="nc-cell-field text-left text-wrap mt-2 text-[#e65100] text-xs">
    {{ $t('msg.warning.nonEditableFields.computedFieldUnableToClear') }}
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
