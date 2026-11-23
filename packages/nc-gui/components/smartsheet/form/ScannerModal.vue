<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import type { CodeScannerError } from '~/components/general/CodeScanner.vue'

const props = defineProps<{
  visible: boolean
  // the form field being filled; shown in the header
  field?: ColumnType & { label?: string }
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
      <div class="flex items-center gap-2">
        <div class="flex-none text-bodyBold text-nc-content-gray-emphasis">{{ $t('activity.fillByCodeScan') }}</div>
        <div
          v-if="field"
          class="min-w-0 h-5 px-1 gap-1 bg-nc-bg-gray-medium text-nc-content-gray-subtle2 rounded-md items-center flex"
          data-testid="nc-form-scanner-field"
        >
          <SmartsheetHeaderIcon :column="field" class="flex-none h-4" />
          <NcTooltip show-on-truncate-only class="truncate text-sm font-medium">
            <template #title>{{ field.label || field.title }}</template>
            {{ field.label || field.title }}
          </NcTooltip>
        </div>
        <div class="flex-1" />
        <NcButton class="!px-1" type="text" size="xs" data-testid="nc-form-scanner-close" @click="vVisible = false">
          <GeneralIcon class="text-md text-nc-content-gray-subtle h-4 w-4" icon="close" />
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
