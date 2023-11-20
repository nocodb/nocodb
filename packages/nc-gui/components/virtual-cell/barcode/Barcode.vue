<script setup lang="ts">
import type { ComputedRef } from 'vue'
import JsBarcodeWrapper from './JsBarcodeWrapper.vue'
import { RowHeightInj, computed, inject, ref } from '#imports'

const maxNumberOfAllowedCharsForBarcodeValue = 100

const cellValue = inject(CellValueInj)

const column = inject(ColumnInj)

const barcodeValue: ComputedRef<string> = computed(() => String(cellValue?.value || ''))

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

const showBarcode = computed(() => barcodeValue?.value.length > 0 && !tooManyCharsForBarcode.value)

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
    class="flex ml-2 w-full items-center"
    :class="{
      'justify-start': isExpandedFormOpen,
      'justify-center': !isExpandedFormOpen,
    }"
  >
    <JsBarcodeWrapper
      v-if="showBarcode && rowHeight"
      :barcode-value="barcodeValue"
      :barcode-format="barcodeMeta.barcodeFormat"
      :custom-style="{ height: rowHeight ? `${rowHeight * 1.4}rem` : `1.4rem`, width: 40 }"
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
      :barcode-value="barcodeValue"
      :barcode-format="barcodeMeta.barcodeFormat"
      @on-click-barcode="showBarcodeModal"
    >
      <template #barcodeRenderError>
        <div class="text-left text-wrap mt-2 text-[#e65100] text-xs" data-testid="barcode-invalid-input-message">
          {{ $t('msg.warning.barcode.renderError') }}
        </div>
      </template>
    </JsBarcodeWrapper>
  </div>

  <div v-if="tooManyCharsForBarcode" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
    {{ $t('labels.barcodeValueTooLong') }}
  </div>
  <div v-if="showEditNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
    {{ $t('msg.warning.nonEditableFields.computedFieldUnableToClear') }}
  </div>
  <div v-if="showClearNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
    {{ $t('msg.warning.nonEditableFields.barcodeFieldsCannotBeDirectlyChanged') }}
  </div>
</template>
