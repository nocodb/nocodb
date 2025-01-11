<script setup lang="ts">
import { useQRCode } from '@vueuse/integrations/useQRCode'
import { message } from 'ant-design-vue'
import type QRCode from 'qrcode'
import { type ColumnType, isVirtualCol } from 'nocodb-sdk'
import { base64ToPNG } from '~/utils/svgToPng'

const { t } = useI18n()

const maxNumberOfAllowedCharsForQrValue = 2000

const cellValue = inject(CellValueInj)
const column = inject(ColumnInj)

const qrValue = computed(() => String(cellValue?.value ?? ''))

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))

const tooManyCharsForQrCode = computed(() => qrValue?.value.length > maxNumberOfAllowedCharsForQrValue)

const showQrCode = computed(() => qrValue?.value?.length > 0 && !tooManyCharsForQrCode.value && qrValue?.value !== 'ERR!')

const qrCodeOptions: QRCode.QRCodeToDataURLOptions = {
  errorCorrectionLevel: 'M',
  margin: 1,
  rendererOpts: {
    quality: 1,
  },
}

const rowHeight = inject(RowHeightInj, ref(undefined))

const qrCode = useQRCode(qrValue, {
  ...qrCodeOptions,
  width: 150,
})

const qrCodeLarge = useQRCode(qrValue, {
  ...qrCodeOptions,
  width: 600,
})

const modalVisible = ref(false)

const showQrModal = (ev?: Event) => {
  ev?.stopPropagation()
  modalVisible.value = true
}

const handleModalOkClick = () => (modalVisible.value = false)

const { metaColumnById } = useViewColumnsOrThrow()
const valueFieldId = computed(() => column?.value.colOptions?.fk_qr_value_column_id)

const { showClearNonEditableFieldWarning } = useShowNotEditableWarning({ onEnter: showQrModal })
const cellIcon = (column: ColumnType) =>
  h(isVirtualCol(column) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: column,
  })

const copyAsPng = () => {
  if (!qrCodeLarge.value) return
  base64ToPNG(qrCodeLarge.value).then((blob) => {
    try {
      navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob,
        }),
      ])
      message.success(t('msg.info.copiedToClipboard'))
    } catch {
      message.error(t('msg.error.notSupported'))
    }
  })
}
</script>

<template>
  <a-modal
    v-model:visible="modalVisible"
    :class="{ active: modalVisible }"
    wrap-class-name="nc-qr-code-large qrcode-modal"
    :body-style="{ padding: '0px', display: 'flex', justifyContent: 'center' }"
    @ok="handleModalOkClick"
  >
    <template #title>
      <div class="flex gap-2">
        <h1 class="font-weight-700">{{ column?.title }}</h1>
        <div class="h-5 mt-[1px] px-1 bg-[#e7e7e9] rounded-md justify-center items-center flex">
          <component :is="cellIcon(metaColumnById?.[valueFieldId])" class="h-4" />
          <div class="text-[#4a5268] text-sm font-medium">{{ metaColumnById?.[valueFieldId]?.title }}</div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex flex-row items-center justify-end mt-4">
        <div class="flex flex-row flex-grow mr-2 !overflow-y-auto py-2 hidden" data-testid="nc-qr-code-large-value-label">
          {{ qrValue }}
        </div>
        <div v-if="showQrCode" class="flex gap-2">
          <NcTooltip>
            <template #title>
              {{ $t('labels.clickToCopy') }}
            </template>
            <NcButton size="small" type="secondary" @click="copyAsPng">
              <template #icon>
                <GeneralIcon icon="copy" class="w-4 h-4" />
              </template>
              {{ $t('general.copy') }}
            </NcButton>
          </NcTooltip>
          <a :href="qrCodeLarge" :download="`${qrValue}.png`">
            <NcTooltip>
              <template #title>
                {{ $t('labels.clickToDownload') }}
              </template>
              <NcButton size="small" type="secondary">
                <template #icon>
                  <GeneralIcon icon="download" class="w-4 h-4" />
                </template>
                {{ $t('general.download') }}
              </NcButton>
            </NcTooltip>
          </a>
        </div>
      </div>
    </template>
    <img v-if="showQrCode" :src="qrCodeLarge" :alt="$t('title.qrCode')" class="h-60" />
  </a-modal>
  <div
    v-if="showQrCode"
    class="nc-qrcode-container w-full flex"
    :class="{
      'flex-start pl-2': isExpandedFormOpen,
      'justify-center': !isExpandedFormOpen,
    }"
  >
    <img
      v-if="rowHeight"
      :style="{
        height: rowHeight ? `${rowHeight === 1 ? rowHeightInPx['1'] - 4 : rowHeightInPx[`${rowHeight}`] - 20}px` : `1.8rem`,
      }"
      :src="qrCode"
      :alt="$t('title.qrCode')"
      class="min-w-[1.4em]"
      @click="showQrModal"
    />
    <img v-else class="flex-none mx-auto min-w-[1.4em]" :src="qrCode" :alt="$t('title.qrCode')" @click="showQrModal" />
  </div>
  <div v-if="tooManyCharsForQrCode" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
    {{ $t('labels.qrCodeValueTooLong') }}
  </div>
  <div v-if="showClearNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
    {{ $t('msg.warning.nonEditableFields.qrFieldsCannotBeDirectlyChanged') }}
  </div>
  <a-tooltip v-else-if="!showQrCode && qrValue === 'ERR!'" placement="bottom" class="text-orange-700">
    <template #title>
      <span class="font-bold">Please select a target field!</span>
    </template>
    <span>ERR!</span>
  </a-tooltip>
</template>

<style>
.qrcode-modal .ant-modal-header {
  position: relative;
  top: -20px;
  width: calc(100% + 24px * 2);
  left: -24px;
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  border-bottom: 1px solid #e7e7e9;
}
</style>
