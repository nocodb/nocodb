<script setup lang="ts">
import { useQRCode } from '@vueuse/integrations/useQRCode'

const value = inject(CellValueInj)

const qrValue = computed(() => value?.value)

const qrCode = useQRCode(qrValue, {
  width: 150,
})
</script>

<template>
  <img v-if="qrValue" :src="qrCode" alt="QR Code" class="qr-code" />
</template>
