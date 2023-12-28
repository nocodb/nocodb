<script setup lang="ts">
import { useQRCode } from '@vueuse/integrations/useQRCode'
import type QRCode from 'qrcode'
import { IsGalleryInj, RowHeightInj, computed, inject, ref } from '#imports'

const maxNumberOfAllowedCharsForQrValue = 2000

const cellValue = inject(CellValueInj)

const isGallery = inject(IsGalleryInj, ref(false))

const qrValue = computed(() => String(cellValue?.value))

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))

const tooManyCharsForQrCode = computed(() => qrValue?.value.length > maxNumberOfAllowedCharsForQrValue)

const showQrCode = computed(() => qrValue?.value?.length > 0 && !tooManyCharsForQrCode.value)

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

const showQrModal = (ev: MouseEvent) => {
  if (isGallery.value) return
  ev.stopPropagation()
  modalVisible.value = true
}

const handleModalOkClick = () => (modalVisible.value = false)

const { showEditNonEditableFieldWarning, showClearNonEditableFieldWarning } = useShowNotEditableWarning()
</script>

<template>
  <a-modal
    v-model:visible="modalVisible"
    :class="{ active: modalVisible }"
    wrap-class-name="nc-qr-code-large"
    :body-style="{ padding: '0px' }"
    @ok="handleModalOkClick"
  >
    <template #footer>
      <div class="flex flex-row">
        <div class="flex flex-row flex-grow mr-2 !overflow-y-auto py-2" data-testid="nc-qr-code-large-value-label">
          {{ qrValue }}
        </div>
        <a v-if="showQrCode" :href="qrCodeLarge" :download="`${qrValue}.png`">
          <NcTooltip>
            <template #title>
              {{ $t('labels.clickToDownload') }}
            </template>
            <NcButton size="small" type="secondary">
              <GeneralIcon icon="download" class="w-4 h-4" />
            </NcButton>
          </NcTooltip>
        </a>
      </div>
    </template>
    <img v-if="showQrCode" :src="qrCodeLarge" :alt="$t('title.qrCode')" />
  </a-modal>
  <div
    v-if="showQrCode"
    class="w-full flex"
    :class="{
      'flex-start pl-2': isExpandedFormOpen,
      'justify-center': !isExpandedFormOpen,
    }"
  >
    <img
      v-if="rowHeight"
      :style="{ height: rowHeight ? `${rowHeight * 1.8}rem` : `1.8rem` }"
      :src="qrCode"
      :alt="$t('title.qrCode')"
      class="min-w-[1.4em]"
      @click="showQrModal"
    />
    <img v-else class="mx-auto min-w-[1.4em]" :src="qrCode" :alt="$t('title.qrCode')" @click="showQrModal" />
  </div>
  <div v-if="tooManyCharsForQrCode" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
    {{ $t('labels.qrCodeValueTooLong') }}
  </div>
  <div v-if="showEditNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
    {{ $t('msg.warning.nonEditableFields.computedFieldUnableToClear') }}
  </div>
  <div v-if="showClearNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
    {{ $t('msg.warning.nonEditableFields.qrFieldsCannotBeDirectlyChanged') }}
  </div>
</template>
