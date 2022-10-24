<script setup lang="ts">
import { useQRCode } from '@vueuse/integrations/useQRCode'

const value = inject(CellValueInj)

const qrValue = computed(() => value?.value)
const qrCode = useQRCode(qrValue, {
  width: 150,
})
const qrCodeLarge = useQRCode(qrValue, {
  width: 600,
})

const visible = ref<boolean>(false)
const showQrModal = () => (visible.value = true)
const handleOk = (e: MouseEvent) => {
  console.log(e)
  visible.value = false
}
</script>

<template>
  <a-modal v-model:visible="visible" :title="qrValue" @ok="handleOk" footer>
    <img v-if="qrValue" :src="qrCodeLarge" alt="QR Code" class="qr-code" />
  </a-modal>
  <img v-if="qrValue" :src="qrCode" alt="QR Code" class="qr-code" @click="showQrModal" />
</template>
