<script setup lang="ts">
import { StreamBarcodeReader } from 'vue-barcode-reader'

const props = defineProps<{
  visible: boolean
}>()

const emits = defineEmits<{
  'update:visible': [value: boolean]
  'decode': [value: string]
}>()

const vVisible = useVModel(props, 'visible', emits)

// checking: asking for camera access; ready: reader mounted; denied / unavailable: no camera to scan with
const cameraState = ref<'checking' | 'ready' | 'denied' | 'unavailable'>('checking')

const isReaderLoaded = ref(false)

// the reader never reports a camera it couldn't open, so give up if the video doesn't start
const { start: startLoadTimeout, stop: stopLoadTimeout } = useTimeoutFn(
  () => {
    if (cameraState.value === 'ready' && !isReaderLoaded.value) cameraState.value = 'unavailable'
  },
  10000,
  { immediate: false },
)

function onReaderLoaded() {
  stopLoadTimeout()
  isReaderLoaded.value = true
}

async function checkCameraAccess() {
  cameraState.value = 'checking'
  isReaderLoaded.value = false

  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    cameraState.value = 'unavailable'
    return
  }

  try {
    // The reader swallows getUserMedia errors, so ask first and release the stream for it
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    stream.getTracks().forEach((track) => track.stop())
    cameraState.value = 'ready'
    startLoadTimeout()
  } catch (e: any) {
    cameraState.value = e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'denied' : 'unavailable'
  }
}

function onDecode(value: string) {
  if (!vVisible.value) return

  emits('decode', value)
  vVisible.value = false
}

watch(
  vVisible,
  (visible) => {
    if (visible) checkCameraAccess()
    else stopLoadTimeout()
  },
  { immediate: true },
)
</script>

<template>
  <NcModal v-model:visible="vVisible" size="xs" height="auto" wrap-class-name="nc-form-scanner-modal" destroy-on-close>
    <div class="flex flex-col gap-3" data-testid="nc-form-scanner-modal">
      <div class="flex items-center justify-between gap-2">
        <div class="text-bodyBold text-nc-content-gray-emphasis">{{ $t('activity.fillByCodeScan') }}</div>
        <NcButton type="text" size="xsmall" data-testid="nc-form-scanner-close" @click="vVisible = false">
          <template #icon>
            <GeneralIcon icon="close" />
          </template>
        </NcButton>
      </div>

      <div class="relative min-h-60 rounded-lg overflow-hidden bg-nc-bg-gray-extralight flex items-center justify-center">
        <template v-if="cameraState === 'ready'">
          <div v-show="isReaderLoaded" class="nc-form-scanner-reader w-full">
            <StreamBarcodeReader @decode="onDecode" @loaded="onReaderLoaded" />
          </div>
          <a-spin v-if="!isReaderLoaded" />
        </template>

        <a-spin v-else-if="cameraState === 'checking'" />

        <div v-else class="flex flex-col items-center gap-3 p-6 text-center" data-testid="nc-form-scanner-error">
          <GeneralIcon icon="ncCamera" class="h-8 w-8 text-nc-content-gray-muted" />
          <div class="text-bodyDefaultSm text-nc-content-gray">
            {{ cameraState === 'denied' ? $t('labels.allowAccessToYourCamera') : $t('msg.error.cameraNotAvailable') }}
          </div>
          <NcButton type="secondary" size="small" data-testid="nc-form-scanner-retry" @click="checkCameraAccess">
            {{ $t('general.retry') }}
          </NcButton>
        </div>
      </div>

      <div v-if="cameraState === 'ready' && isReaderLoaded" class="text-bodySm text-nc-content-gray-muted text-center">
        {{ $t('labels.pointCameraAtCode') }}
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
// the reader's video is inline (baseline gap) and its overlay stops at 99%, leaving a light strip at the bottom
.nc-form-scanner-reader :deep(video) {
  @apply block w-full max-w-full;
}

.nc-form-scanner-reader :deep(.overlay-element) {
  @apply h-full;
}
</style>
