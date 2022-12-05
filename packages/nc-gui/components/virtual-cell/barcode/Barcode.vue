 <script setup lang="ts">
// import VueBarcode from '@chenfengyuan/vue-barcode'
import JsBarcodeWrapper from './JsBarcodeWrapper'

const maxNumberOfAllowedCharsForQrValue = 2000

const cellValue = inject(CellValueInj)

const barcodeValue = computed(() => String(cellValue?.value))

const tooManyCharsForQrCode = computed(() => barcodeValue?.value.length > maxNumberOfAllowedCharsForQrValue)


const modalVisible = ref(false)

const showQrModal = (ev: MouseEvent) => {
  ev.stopPropagation()
  modalVisible.value = true
}

const handleModalOkClick = () => (modalVisible.value = false)

const { showEditNonEditableFieldWarning, showClearNonEditableFieldWarning } = useShowNotEditableWarning()
</script>

<template>
  <a-modal
    v-model:visible="modalVisible"
    :class="{ active: modalVisible }"
    wrap-class-name="nc-qr-code-large"
    :body-style="{ padding: '0px' }"
    @ok="handleModalOkClick"
  >
    <template #footer>
      <div class="mr-4" data-testid="nc-qr-code-large-value-label">{{ barcodeValue }}</div>
    </template>
    <JsBarcodeWrapper v-if="barcodeValue && !tooManyCharsForQrCode" tag="svg" :value="barcodeValue" width="3" />
  </a-modal>
  <div @click="showQrModal">
    <JsBarcodeWrapper v-if="barcodeValue && !tooManyCharsForQrCode" :value="barcodeValue" width="1"></JsBarcodeWrapper>
  </div>

  <div v-if="tooManyCharsForQrCode" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
    {{ $t('labels.barcodeValueTooLong') }}
  </div>
  <div v-if="showEditNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
    {{ $t('msg.warning.nonEditableFields.computedFieldUnableToClear') }}
  </div>
  <div v-if="showClearNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
    {{ $t('msg.warning.nonEditableFields.qrFieldsCannotBeDirectlyChanged') }}
  </div>
</template>
