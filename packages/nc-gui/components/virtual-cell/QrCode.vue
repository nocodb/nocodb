<script setup lang="ts">
import { useQRCode } from '@vueuse/integrations/useQRCode'
import type QRCode from 'qrcode'
import { type ColumnType, isVirtualCol } from 'nocodb-sdk'
import { IsCanvasInjectionInj } from '../../context'
import { base64ToBlob, copyPNGToClipboard } from '~/utils/svgToPng'

const { t } = useI18n()

const isCanvasInjected = inject(IsCanvasInjectionInj, false)
const isUnderLookup = inject(IsUnderLookupInj, ref(false))

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
  if (!showQrCode.value) return
  ev?.stopPropagation()
  modalVisible.value = true
}

const handleModalOkClick = () => (modalVisible.value = false)

const meta = inject(MetaInj)
const valueFieldId = computed(() => column?.value.colOptions?.fk_qr_value_column_id)

const { showClearNonEditableFieldWarning } = useShowNotEditableWarning({ onEnter: showQrModal })
const cellIcon = (column: ColumnType) =>
  h(isVirtualCol(column) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: column,
  })

const { isCopied, performCopy } = useIsCopied()

const copyAsPng = async () => {
  if (!qrCodeLarge.value) return
  const blob = await base64ToBlob(qrCodeLarge.value)
  const success = await copyPNGToClipboard(blob)
  if (!success) throw new Error(t('msg.error.notSupported'))
}

const height = computed(() => {
  if (isExpandedFormOpen.value) {
    return undefined
  }

  if (!rowHeight.value) {
    return '1.8rem'
  }

  return `${rowHeight.value === 1 ? rowHeightInPx['1']! - 4 : rowHeightInPx[`${rowHeight.value}`]! - 20}px`
})

onMounted(() => {
  if (isCanvasInjected && !isUnderLookup.value && !isExpandedFormOpen.value) {
    if (showQrCode.value) {
      modalVisible.value = true
    }
  }
})
</script>

<template>
  <a-modal
    v-model:visible="modalVisible"
    :class="{ active: modalVisible }"
    wrap-class-name="nc-qr-code-large qrcode-modal"
    :body-style="{ padding: '0px', display: 'flex', justifyContent: 'center' }"
    :closable="false"
    @ok="handleModalOkClick"
  >
    <template #title>
      <div class="flex gap-2 items-center w-full">
        <h1 class="font-weight-700 m-0">{{ column?.title }}</h1>
        <div class="h-5 px-1 bg-nc-bg-gray-medium text-nc-content-gray-subtle2 rounded-md justify-center items-center flex">
          <component :is="cellIcon(meta?.columnsById?.[valueFieldId])" class="h-4" />
          <div class="text-sm font-medium">{{ meta?.columnsById?.[valueFieldId]?.title }}</div>
        </div>
        <div class="flex-1"></div>
        <NcButton class="nc-qrcode-close !px-1" type="text" size="xs" @click="modalVisible = false">
          <GeneralIcon class="text-md text-gray-700 h-4 w-4" icon="close" />
        </NcButton>
      </div>
    </template>
    <template #footer>
      <div class="flex flex-row items-center justify-end">
        <div class="flex flex-row flex-grow mr-2 !overflow-y-auto py-2 hidden" data-testid="nc-qr-code-large-value-label">
          {{ qrValue }}
        </div>
        <div v-if="showQrCode" class="flex gap-2">
          <NcTooltip>
            <template #title>
              {{ $t('labels.clickToCopy') }}
            </template>
            <NcButton size="small" type="secondary" @click="performCopy(copyAsPng)">
              <template #icon>
                <div class="flex children:flex-none relative h-4 w-4">
                  <Transition name="icon-fade" :duration="200">
                    <GeneralIcon v-if="isCopied" icon="check" class="h-4 w-4 opacity-80" />
                    <GeneralIcon v-else icon="copy" class="h-4 w-4 opacity-80" />
                  </Transition>
                </div>
              </template>
              {{ isCopied ? $t('general.copied') : $t('general.copy') }}
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
    <img v-if="showQrCode" :src="qrCodeLarge" :alt="$t('title.qrCode')" class="h-[156px] mt-8 mb-4" />
  </a-modal>
  <div
    v-if="showQrCode"
    class="nc-qrcode-container w-full flex"
    :class="{
      'flex-start h-20': isExpandedFormOpen,
      'justify-center': !isExpandedFormOpen,
    }"
  >
    <img
      v-if="rowHeight"
      :style="{ height }"
      :class="{
        'border-1': isExpandedFormOpen,
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

<style lang="scss">
.qrcode-modal .ant-modal-content {
  padding: 0 !important;
  .ant-modal-header {
    position: relative;
    padding: 8px 16px;
    border-top-left-radius: 1em;
    border-top-right-radius: 1em;
    border-bottom: 1px solid #e7e7e9;
    .ant-modal-title {
      height: 30px;
      display: flex;
      align-items: center;
    }
  }
  .ant-modal-footer {
    padding: 8px 12px;
    border: none;
  }
}

.nc-data-cell {
  &:has(.nc-virtual-cell-qrcode) {
    @apply !border-none;
    box-shadow: none !important;

    &:focus-within:not(.nc-readonly-div-data-cell):not(.nc-system-field) {
      box-shadow: none !important;
    }
  }
}
</style>
