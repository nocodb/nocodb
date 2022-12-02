 <script setup lang="ts">
import VueBarcode from '@chenfengyuan/vue-barcode'

const maxNumberOfAllowedCharsForQrValue = 2000

const cellValue = inject(CellValueInj)

const barcodeValue = computed(() => String(cellValue?.value))

const tooManyCharsForQrCode = computed(() => barcodeValue?.value.length > maxNumberOfAllowedCharsForQrValue)

// const barcode = VueBarcode(barcodeValue, {
//   width: 150,
// })

// const barcodeLarge = VueBarcode(barcodeValue, {
//   width: 600,
// })

const modalVisible = ref(false)

const showQrModal = (ev: MouseEvent) => {
  ev.stopPropagation()
  modalVisible.value = true
}

const handleModalOkClick = () => (modalVisible.value = false)

const { showEditNonEditableFieldWarning, showClearNonEditableFieldWarning } = useShowNotEditableWarning()
</script>

<template>
  <vue-barcode value="barcodeValue"></vue-barcode>
  <a-modal
    v-model:visible="modalVisible"
    :class="{ active: modalVisible }"
    wrap-class-name="nc-qr-code-large"
    :body-style="{ padding: '0px' }"
    @ok="handleModalOkClick"
  >
    <template #footer>
      <div class="mr-4" data-testid="nc-qr-code-large-value-label">heja</div>
    </template>
    <!-- <img v-if="barcodeValue && !tooManyCharsForQrCode" :src="qrCodeLarge" alt="QR Code" /> -->
  </a-modal>
  <div @click="showQrModal">
    <VueBarcode value="barcodeValue"></VueBarcode>
  </div>

  <!-- <div v-if="tooManyCharsForQrCode" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
    {{ $t('labels.qrCodeValueTooLong') }}
  </div>
 <img v-if="qrValue && !tooManyCharsForQrCode" :src="qrCode" alt="QR Code" @click="showQrModal" /> -->
  <!-- <div v-if="showEditNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
    {{ $t('msg.warning.nonEditableFields.computedFieldUnableToClear') }}
  </div>
  <div v-if="showClearNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
    {{ $t('msg.warning.nonEditableFields.qrFieldsCannotBeDirectlyChanged') }}
  </div>
  -->
</template>
