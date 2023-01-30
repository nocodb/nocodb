<script setup lang="ts">
import { useQRCode } from '@vueuse/integrations/useQRCode'
import type { GridType } from 'nocodb-sdk'
import { ActiveViewInj } from '#imports'

const maxNumberOfAllowedCharsForQrValue = 2000

const view = inject(ActiveViewInj, ref())

const cellValue = inject(CellValueInj)

const qrValue = computed(() => String(cellValue?.value))

const tooManyCharsForQrCode = computed(() => qrValue?.value.length > maxNumberOfAllowedCharsForQrValue)

const showQrCode = computed(() => qrValue?.value?.length > 0 && !tooManyCharsForQrCode.value)

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
      default:
        return 1
    }
  }
})

const qrCode = useQRCode(qrValue, {
  width: 150,
})

const qrCodeLarge = useQRCode(qrValue, {
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
    v-if="showQrCode"
    class="mx-auto"
    :style="{ height: rowHeight ? `${rowHeight * 1.4}rem` : `1.4rem` }"
    :src="qrCode"
    alt="QR Code"
    @click="showQrModal"
  />
  <div v-if="showEditNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
    {{ $t('msg.warning.nonEditableFields.computedFieldUnableToClear') }}
  </div>
  <div v-if="showClearNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
    {{ $t('msg.warning.nonEditableFields.qrFieldsCannotBeDirectlyChanged') }}
  </div>
</template>
