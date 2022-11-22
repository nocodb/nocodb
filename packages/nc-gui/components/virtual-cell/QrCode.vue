<script setup lang="ts">
import { useQRCode } from '@vueuse/integrations/useQRCode'

const cellValue = inject(CellValueInj)

const qrValue = computed(() => String(cellValue?.value))

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
</script>

<template>
  <a-modal
    v-model:visible="modalVisible"
    footer
    wrap-class-name="nc-qr-code-large"
    :body-style="{ padding: '0px' }"
    @ok="handleModalOkClick"
  >
    <template #title>
      <div class="mr-4" data-testid="nc-qr-code-large-value-label">{{ qrValue }}</div>
    </template>
    <img v-if="qrValue" :src="qrCodeLarge" alt="QR Code" />
  </a-modal>
  <img v-if="qrValue" :src="qrCode" alt="QR Code" @click="showQrModal" />
</template>
