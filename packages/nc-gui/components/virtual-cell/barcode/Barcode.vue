<script setup lang="ts">
import JsBarcodeWrapper from './JsBarcodeWrapper.vue'

const maxNumberOfAllowedCharsForBarcodeValue = 100

const cellValue = inject(CellValueInj)

const column = inject(ColumnInj)

const barcodeValue = computed(() => String(cellValue?.value))

const tooManyCharsForBarcode = computed(() => barcodeValue?.value.length > maxNumberOfAllowedCharsForBarcodeValue)

const modalVisible = ref(false)

const showBarcodeModal = () => {
  modalVisible.value = true
}

const barcodeMeta = $computed(() => {
  return {
    barcodeFormat: 'CODE128',
    ...(column?.value?.meta || {}),
  }
})

const handleModalOkClick = () => (modalVisible.value = false)

const { showEditNonEditableFieldWarning, showClearNonEditableFieldWarning } = useShowNotEditableWarning()
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
      v-if="barcodeValue && !tooManyCharsForBarcode"
      :barcode-value="barcodeValue"
      :barcode-format="barcodeMeta.barcodeFormat"
    >
      <template #barcodeRenderError>
        <div class="text-left text-wrap mt-2 text-[#e65100] text-xs">
          {{ $t('msg.warning.barcode.renderError') }}
        </div>
      </template>
    </JsBarcodeWrapper>
  </a-modal>
  <JsBarcodeWrapper
    v-if="barcodeValue && !tooManyCharsForBarcode"
    :barcode-value="barcodeValue"
    :barcode-format="barcodeMeta.barcodeFormat"
    class="nc-barcode-svg"
    @on-click-barcode="showBarcodeModal"
  >
    <template #barcodeRenderError>
      <div class="text-left text-wrap mt-2 text-[#e65100] text-xs">
        {{ $t('msg.warning.barcode.renderError') }}
      </div>
    </template>
  </JsBarcodeWrapper>

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
