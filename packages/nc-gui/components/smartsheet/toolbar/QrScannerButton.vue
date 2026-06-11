<script setup lang="ts">
import type { SelectProps } from 'ant-design-vue'
import { ref } from 'vue'
import { StreamBarcodeReader } from 'vue-barcode-reader'
import type { ColumnType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'

const meta = inject(MetaInj, ref())

const { t } = useI18n()

const route = useRoute()

const router = useRouter()

const { $api } = useNuxtApp()

const { base } = storeToRefs(useBase())

const { isMobileMode } = useGlobal()

const view = inject(ActiveViewInj, ref())

const fieldOptionsOfSupportedColumnsToScanFor = computed<SelectProps['options']>(
  () =>
    meta?.value
      ?.columns!.filter((column) => column.uidt && [UITypes.QrCode, UITypes.Barcode].includes(column.uidt))
      .map((field) => {
        return {
          value: field.id,
          label: field.title,
        }
      }) || [],
)

const getColumnToSearchForByBarOrQrCodeColumnId = (columnId: string): ColumnType => {
  const qrOrBarcodeColumn = meta.value?.columns?.find((column) => column.id === columnId)
  if (!qrOrBarcodeColumn) {
    throw new Error('QrCode or BarCode Column not found')
  }
  let columnIdToSearchFor: string
  if (qrOrBarcodeColumn.uidt === UITypes.QrCode) {
    columnIdToSearchFor = (qrOrBarcodeColumn.colOptions as any).fk_qr_value_column_id
  } else if (qrOrBarcodeColumn.uidt === UITypes.Barcode) {
    columnIdToSearchFor = (qrOrBarcodeColumn.colOptions as any).fk_barcode_value_column_id
  } else {
    throw new Error('Column to scan for is not of supported type')
  }
  const columnToSearchFor = meta.value?.columns?.find((column) => column.id === columnIdToSearchFor)
  if (!columnToSearchFor) {
    throw new Error('Column to search for not found')
  }
  return columnToSearchFor
}

const showCodeScannerOverlay = ref(false)

const idOfSelectedColumnToScanFor = ref('')
const lastScannedCode = ref('')

watch(fieldOptionsOfSupportedColumnsToScanFor, () => {
  if (fieldOptionsOfSupportedColumnsToScanFor.value?.every((option) => option.value !== idOfSelectedColumnToScanFor.value)) {
    idOfSelectedColumnToScanFor.value = ''
  }
})

const scannerIsReady = ref(false)

const onLoaded = async () => {
  scannerIsReady.value = true
}

const showScannerField = computed(() => scannerIsReady.value && idOfSelectedColumnToScanFor.value !== '')
const showPleaseSelectColumnMessage = computed(() => !idOfSelectedColumnToScanFor.value)
const showScannerIsLoadingMessage = computed(() => !!idOfSelectedColumnToScanFor.value && !scannerIsReady.value)

const onDecode = async (codeValue: string) => {
  if (!showScannerField.value || codeValue === lastScannedCode.value) {
    return
  }
  try {
    const selectedColumnToScanFor = getColumnToSearchForByBarOrQrCodeColumnId(idOfSelectedColumnToScanFor.value)
    const whereClause = `(${selectedColumnToScanFor?.title},eq,${codeValue})`
    const foundRowsForCode = (
      await $api.dbViewRow.list(NOCO, base.value.id!, meta.value!.id!, view.value!.title!, {
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
        <component :is="iconMap.qrCode" />
        <span v-if="!isMobileMode" class="!text-xs font-weight-normal"> {{ $t('activity.findRowByCodeScan') }}</span>
      </div>
    </a-button>
    <a-modal
      v-model:visible="showCodeScannerOverlay"
      class="nc-overlay-find-row-by-scan"
      :closable="false"
      width="28rem"
      centered
      :footer="null"
      wrap-class-name="nc-modal-generate-token"
      destroy-on-close
      @cancel="scannerIsReady = false"
    >
      <div class="relative flex flex-col h-full">
        <div class="text-left text-wrap mt-2 text-xl mb-4">{{ $t('title.findRowByScanningCode') }}</div>
        <a-form-item :label="$t('labels.columnToScanFor')" class="nc-dropdown-scanner-column-id">
          <a-select
            v-model:value="idOfSelectedColumnToScanFor"
            class="w-full"
            :options="fieldOptionsOfSupportedColumnsToScanFor"
          />
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
