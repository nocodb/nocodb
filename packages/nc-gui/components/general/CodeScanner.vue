<script lang="ts">
import { type BarcodeFormat, type DetectedBarcode, QrcodeStream, setZXingModuleOverrides } from 'vue-qrcode-reader'
import zxingReaderWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

// Serve the decoder from our own build instead of the default CDN, so self-hosted and offline installs can scan
setZXingModuleOverrides({
  locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? zxingReaderWasmUrl : prefix + path),
})

export type CodeScannerError = 'denied' | 'unavailable'
</script>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    paused?: boolean
  }>(),
  {
    paused: false,
  },
)

const emits = defineEmits<{
  detect: [value: string]
  ready: []
  error: [error: CodeScannerError]
}>()

// QR and 2D codes, retail product barcodes, and the common inventory / shipping barcodes
const SCAN_FORMATS: BarcodeFormat[] = [
  'qr_code',
  'data_matrix',
  'pdf417',
  'aztec',
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'code_93',
  'codabar',
  'itf',
]

const constraints: MediaTrackConstraints = { facingMode: 'environment' }

function onDetect(detectedCodes: DetectedBarcode[]) {
  const value = detectedCodes.find((code) => code.rawValue)?.rawValue
  if (value) emits('detect', value)
}

function onError(error: Error) {
  emits('error', error?.name === 'NotAllowedError' || error?.name === 'SecurityError' ? 'denied' : 'unavailable')
}
</script>

<template>
  <div class="nc-code-scanner">
    <QrcodeStream
      :formats="SCAN_FORMATS"
      :constraints="constraints"
      :paused="props.paused"
      @detect="onDetect"
      @camera-on="emits('ready')"
      @error="onError"
    >
      <div class="nc-code-scanner-frame" />
    </QrcodeStream>
  </div>
</template>

<style lang="scss" scoped>
.nc-code-scanner {
  @apply relative w-full overflow-hidden;

  :deep(video) {
    @apply block w-full;
  }
}

// Dim everything outside a centred scan window
.nc-code-scanner-frame {
  @apply absolute rounded-md pointer-events-none;
  inset: 20% 10%;
  box-shadow: 0 0 0 9999px rgba(30, 30, 30, 0.45);
}
</style>
