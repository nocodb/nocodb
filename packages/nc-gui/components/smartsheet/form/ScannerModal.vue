<script setup lang="ts">
import type { CodeScannerError } from '~/components/general/CodeScanner.vue'

const props = defineProps<{
  visible: boolean
}>()

const emits = defineEmits<{
  'update:visible': [value: boolean]
  'decode': [value: string]
}>()

const vVisible = useVModel(props, 'visible', emits)

// starting: waiting for the camera; ready: video is running; denied / unavailable: no camera to scan with
const cameraState = ref<'starting' | 'ready' | CodeScannerError>('starting')

// Remounting the scanner asks for the camera again
const scannerKey = ref(0)

function retry() {
  cameraState.value = 'starting'
  scannerKey.value++
}

function onDecode(value: string) {
  if (!vVisible.value) return

  emits('decode', value)
  vVisible.value = false
}

watch(vVisible, (visible) => {
  if (visible) cameraState.value = 'starting'
})
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
        <div v-if="cameraState === 'starting' || cameraState === 'ready'" v-show="cameraState === 'ready'" class="w-full">
          <GeneralCodeScanner :key="scannerKey" @detect="onDecode" @ready="cameraState = 'ready'" @error="cameraState = $event" />
        </div>

        <a-spin v-if="cameraState === 'starting'" class="!absolute" />

        <div
          v-if="cameraState === 'denied' || cameraState === 'unavailable'"
          class="flex flex-col items-center gap-3 p-6 text-center"
          data-testid="nc-form-scanner-error"
        >
          <GeneralIcon icon="ncCamera" class="h-8 w-8 text-nc-content-gray-muted" />
          <div class="text-bodyDefaultSm text-nc-content-gray">
            {{ cameraState === 'denied' ? $t('labels.allowAccessToYourCamera') : $t('msg.error.cameraNotAvailable') }}
          </div>
          <NcButton type="secondary" size="small" data-testid="nc-form-scanner-retry" @click="retry">
            {{ $t('general.retry') }}
          </NcButton>
        </div>
      </div>

      <div v-if="cameraState === 'ready'" class="text-bodySm text-nc-content-gray-muted text-center">
        {{ $t('labels.pointCameraAtCode') }}
      </div>
    </div>
  </NcModal>
</template>
