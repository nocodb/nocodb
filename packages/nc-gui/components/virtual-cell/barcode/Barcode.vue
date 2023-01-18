<script setup lang="ts">
import JsBarcodeWrapper from './JsBarcodeWrapper.vue'
import { ComputedRef } from 'vue'
import { GridType } from 'nocodb-sdk'
import { ActiveViewInj } from '#imports'

const maxNumberOfAllowedCharsForBarcodeValue = 100

const view = inject(ActiveViewInj, ref())

const cellValue = inject(CellValueInj)

const column = inject(ColumnInj)

const barcodeValue: ComputedRef<string> = computed(() => String(cellValue?.value || ''))

const tooManyCharsForBarcode = computed(() => barcodeValue.value.length > maxNumberOfAllowedCharsForBarcodeValue)

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

const showBarcode = computed(() => barcodeValue?.value.length > 0 && !tooManyCharsForBarcode.value)

const { showEditNonEditableFieldWarning, showClearNonEditableFieldWarning } = useShowNotEditableWarning()


const rowHeight = computed(() => {
  if ((view.value?.view as GridType)?.row_height !== undefined) {
    switch ((view.value?.view as GridType)?.row_height) {
      case 0:
        return 1
      case 1:
        return 2
      case 2:
        return 4
      case 3:
        return 6
    }
  }
})
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
    <JsBarcodeWrapper v-if="showBarcode" :barcode-value="barcodeValue" :barcode-format="barcodeMeta.barcodeFormat" />
  </a-modal>
  <JsBarcodeWrapper
    v-if="showBarcode"
    :barcode-value="barcodeValue"
    :barcode-format="barcodeMeta.barcodeFormat"
    :custom-style="{ height: rowHeight ? `${rowHeight * 1.4}rem` : `1.4rem` }"
    @on-click-barcode="showBarcodeModal"
  >
    <template #barcodeRenderError>
      <div class="text-left text-wrap mt-2 text-[#e65100] text-xs" data-testid="barcode-invalid-input-message">
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
