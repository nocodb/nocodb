<script setup lang="ts">
import { useQRCode } from '@vueuse/integrations/useQRCode'

const value = inject(CellValueInj)

const qrCode =
  value?.value &&
  useQRCode(value?.value, {
    width: 150,
  })
</script>

<template>
  <img v-if="qrCode" :src="qrCode" alt="QR Code" class="qr-code" />
</template>
