<script setup lang="ts">
import type { SelectProps } from 'ant-design-vue'
import { UITypes } from 'nocodb-sdk'
import { ref } from 'vue'
import { StreamBarcodeReader } from 'vue-barcode-reader'
import { NOCO } from '#imports'
import QrCodeScan from '~icons/mdi/qrcode-scan'

const meta = inject(MetaInj, ref())

const route = useRoute()
const router = useRouter()

const { $api } = useNuxtApp()
const { project } = useProject()

const view = inject(ActiveViewInj, ref())

const qrCodeFieldOptions = ref<SelectProps['options']>([])

interface Entry {
  name: string
}

onBeforeMount(init)

async function init() {
  qrCodeFieldOptions.value = meta?.value?.columns!.map((field) => {
    return {
      value: field.id,
      label: field.title,
    }
  })
}

const showQrCodeScanner = ref(false)
const entry = ref<Entry | null>(null)

const selectedCodeColumnIdToScanFor = ref('')

const onDecode = async (qrCodeValue: string) => {
  try {
    showQrCodeScanner.value = false

    const nameOfSelectedColumnToScanFor = meta.value?.columns?.find(
      (column) => column.id === selectedCodeColumnIdToScanFor.value,
    )?.title
    const whereClause = `(${nameOfSelectedColumnToScanFor},eq,${qrCodeValue})`
    const foundRowForQrCode = await $api.dbViewRow.findOne(NOCO, project.value!.id!, meta.value!.id!, view.value!.title!, {
      where: whereClause,
    })

    const primaryKeyValueForFoundRow = extractPkFromRow(foundRowForQrCode, meta!.value!.columns!)

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

const scannerIsReady = ref(false)

const onLoaded = async () => {
  scannerIsReady.value = true
}

// TODO: ensure that when modal is closed, scannerIsReady gets set back to false
</script>

<template>
  <div>
    <a-button class="nc-btn-share-view nc-toolbar-btn" @click="showQrCodeScanner = true">
      <div class="flex items-center gap-1">
        <QrCodeScan />
        <!-- Share View -->
        <span class="!text-sm font-weight-normal"> {{ $t('activity.scanQrCode') }}</span>
      </div>
    </a-button>
    <a-modal
      v-model:visible="showQrCodeScanner"
      :class="{ active: showQrCodeScanner }"
      :closable="false"
      width="28rem"
      centered
      :footer="null"
      wrap-class-name="nc-modal-generate-token"
      destroy-on-close
    >
      <div class="relative flex flex-col h-full">
        <a-form-item :label="$t('labels.qrCodeColumn')">
          <a-select
            v-model:value="selectedCodeColumnIdToScanFor"
            class="w-full"
            :options="qrCodeFieldOptions"
            placeholder="Select a Code Field (QR or Barcode)"
            not-found-content="No Code Field can be found. Please create one first."
          />
        </a-form-item>

        <!-- <qrcode-stream v-if="showQrCodeScanner" @decode="onDecode" style="width: 100%; height: 100%"></qrcode-stream> -->
        <div>
          <StreamBarcodeReader v-show="scannerIsReady" @decode="onDecode" @loaded="onLoaded"></StreamBarcodeReader>
          <div v-if="!scannerIsReady">Loading the scanner...</div>
        </div>
      </div>
    </a-modal>

    <p v-if="entry">Entry found: {{ entry.name }}</p>
  </div>
</template>
