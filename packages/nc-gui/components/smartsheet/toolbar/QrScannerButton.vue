<script setup lang="ts">
import type { SelectProps } from 'ant-design-vue'
import { ref } from 'vue'
import { StreamBarcodeReader } from 'vue-barcode-reader'
import { NOCO } from '#imports'
import QrCodeScan from '~icons/mdi/qrcode-scan'

const meta = inject(MetaInj, ref())

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const { $api } = useNuxtApp()
const { project } = useProject()

const { isMobileMode } = useGlobal()

const view = inject(ActiveViewInj, ref())

const codeFieldOptions = computed<SelectProps['options']>(
  () =>
    meta?.value?.columns!.map((field) => {
      return {
        value: field.id,
        label: field.title,
      }
    }) || [],
)

const showCodeScannerOverlay = ref(false)

const selectedCodeColumnIdToScanFor = ref('')
const lastScannedCode = ref('')

const scannerIsReady = ref(false)

const onLoaded = async () => {
  scannerIsReady.value = true
}

const showScannerField = computed(() => scannerIsReady.value && selectedCodeColumnIdToScanFor.value !== '')
const showPleaseSelectColumnMessage = computed(() => !selectedCodeColumnIdToScanFor.value)
const showScannerIsLoadingMessage = computed(() => !!selectedCodeColumnIdToScanFor.value && !scannerIsReady.value)

const onDecode = async (codeValue: string) => {
  if (!showScannerField.value || codeValue === lastScannedCode.value) {
    return
  }
  try {
    const nameOfSelectedColumnToScanFor = meta.value?.columns?.find(
      (column) => column.id === selectedCodeColumnIdToScanFor.value,
    )?.title
    const whereClause = `(${nameOfSelectedColumnToScanFor},eq,${codeValue})`
    const foundRowsForCode = (
      await $api.dbViewRow.list(NOCO, project.value!.id!, meta.value!.id!, view.value!.title!, {
        where: whereClause,
      })
    ).list

    if (foundRowsForCode.length !== 1) {
      showCodeScannerOverlay.value = true
      lastScannedCode.value = codeValue
      setTimeout(() => {
        lastScannedCode.value = ''
      }, 4000)
      if (foundRowsForCode.length === 0) {
        message.info(t('msg.info.codeScanner.noRowFoundForCode'))
      }
      if (foundRowsForCode.length > 1) {
        message.warn(t('msg.info.codeScanner.moreThanOneRowFoundForCode'))
        showCodeScannerOverlay.value = false
        lastScannedCode.value = ''
      }
      return
    }

    showCodeScannerOverlay.value = false
    lastScannedCode.value = ''
    const primaryKeyValueForFoundRow = extractPkFromRow(foundRowsForCode[0], meta!.value!.columns!)

    router.push({
      query: {
        ...route.query,
        rowId: primaryKeyValueForFoundRow,
      },
    })
  } catch (error) {
    console.error(error)
  }
}
</script>

<template>
  <div>
    <a-button class="nc-btn-find-row-by-scan nc-toolbar-btn" @click="showCodeScannerOverlay = true">
      <div class="flex items-center gap-1">
        <QrCodeScan />
        <span v-if="!isMobileMode" class="!text-xs font-weight-normal"> {{ $t('activity.scanCode') }}</span>
      </div>
    </a-button>
    <a-modal
      v-model:visible="showCodeScannerOverlay"
      :closable="false"
      width="28rem"
      centered
      :footer="null"
      wrap-class-name="nc-modal-generate-token"
      destroy-on-close
      @cancel="scannerIsReady = false"
    >
      <div class="relative flex flex-col h-full">
        <a-form-item :label="$t('labels.columnToScanFor')">
          <a-select v-model:value="selectedCodeColumnIdToScanFor" class="w-full" :options="codeFieldOptions" />
        </a-form-item>

        <div>
          <StreamBarcodeReader v-show="showScannerField" @decode="onDecode" @loaded="onLoaded"></StreamBarcodeReader>
          <div v-if="showPleaseSelectColumnMessage" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
            {{ $t('msg.info.codeScanner.selectColumn') }}
          </div>
          <div v-if="showScannerIsLoadingMessage" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
            {{ $t('msg.info.codeScanner.loadingScanner') }}
          </div>
        </div>
      </div>
    </a-modal>
  </div>
</template>
