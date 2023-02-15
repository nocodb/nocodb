<script setup lang="ts">
import { useQRCode } from '@vueuse/integrations/useQRCode'
import type QRCode from 'qrcode'
import { RowHeightInj } from '#imports'

const maxNumberOfAllowedCharsForQrValue = 2000

const cellValue = inject(CellValueInj)

const qrValue = computed(() => String(cellValue?.value))

const tooManyCharsForQrCode = computed(() => qrValue?.value.length > maxNumberOfAllowedCharsForQrValue)

const showQrCode = computed(() => qrValue?.value?.length > 0 && !tooManyCharsForQrCode.value)

const qrCodeOptions: QRCode.QRCodeToDataURLOptions = {
  errorCorrectionLevel: 'M',
  margin: 1,
  version: 4,
  rendererOpts: {
    quality: 1,
  },
}
const rowHeight = inject(RowHeightInj)

const qrCode = useQRCode(qrValue, {
  ...qrCodeOptions,
  width: 150,
})

const qrCodeLarge = useQRCode(qrValue, {
  ...qrCodeOptions,
  width: 600,
})

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
      <div class="mr-4" data-testid="nc-qr-code-large-value-label">{{ qrValue }}</div>
    </template>
    <img v-if="showQrCode" :src="qrCodeLarge" alt="QR Code" />
  </a-modal>
  <div v-if="tooManyCharsForQrCode" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
    {{ $t('labels.qrCodeValueTooLong') }}
  </div>
  <img
    v-if="showQrCode && rowHeight"
    class="mx-auto"
    :style="{ height: rowHeight ? `${rowHeight * 1.4}rem` : `1.4rem` }"
    :src="qrCode"
    alt="QR Code"
    @click="showQrModal"
  />
  <img v-else-if="showQrCode" class="mx-auto" :src="qrCode" alt="QR Code" @click="showQrModal" />
  <div v-if="showEditNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
    {{ $t('msg.warning.nonEditableFields.computedFieldUnableToClear') }}
  </div>
  <div v-if="showClearNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
    {{ $t('msg.warning.nonEditableFields.qrFieldsCannotBeDirectlyChanged') }}
  </div>
</template>
