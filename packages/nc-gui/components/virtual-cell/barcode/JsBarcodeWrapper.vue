<script lang="ts" setup>
import JsBarcode from 'jsbarcode'
import { downloadSvg as _downloadSvg, copySVGToClipboard } from '~/utils/svgToPng'

const props = defineProps({
  barcodeValue: { type: String, required: true },
  barcodeFormat: { type: String, required: true },
  customStyle: { type: Object, required: false },
  showDownload: { type: Boolean, required: false, default: false },
})
const emit = defineEmits(['onClickBarcode'])

const { t } = useI18n()

const isGallery = inject(IsGalleryInj, ref(false))

const barcodeSvgRef = ref<SVGGraphicsElement>()
const errorForCurrentInput = ref(false)

const generate = () => {
  try {
    JsBarcode(barcodeSvgRef.value, String(props.barcodeValue), {
      format: props.barcodeFormat,
      displayValue: false,
      margin: 0,
    })
    if (props.customStyle) {
      if (barcodeSvgRef.value) {
        for (const key in props.customStyle) {
          barcodeSvgRef.value.style.setProperty(key, props.customStyle[key])
        }
      }
    }
    errorForCurrentInput.value = false
  } catch (e) {
    console.log('e', e)
    errorForCurrentInput.value = true
  }
}

const downloadSvg = () => {
  if (!barcodeSvgRef.value) return

  _downloadSvg(barcodeSvgRef.value, `${props.barcodeValue}.png`)
}
const { isCopied, performCopy } = useIsCopied()

const copyAsPng = async () => {
  if (!barcodeSvgRef.value) return
  const success = await copySVGToClipboard(barcodeSvgRef.value)
  if (!success) throw new Error(t('msg.error.notSupported'))
}

const onBarcodeClick = (ev: MouseEvent) => {
  ev.stopPropagation()
  emit('onClickBarcode')
}

watch([() => props.barcodeValue, () => props.barcodeFormat, () => props.customStyle], generate)
onMounted(generate)
</script>

<template>
  <div class="relative">
    <svg
      v-show="!errorForCurrentInput"
      ref="barcodeSvgRef"
      :class="{
        'w-full': !isGallery,
        'w-auto': isGallery,
        'mt-8 mb-4': showDownload,
      }"
      data-testid="barcode"
      @click="onBarcodeClick"
    ></svg>
    <slot v-if="errorForCurrentInput" name="barcodeRenderError" />
    <div v-if="props.showDownload" class="flex justify-end gap-2 py-2 px-3">
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
      <NcTooltip>
        <template #title>
          {{ $t('labels.clickToDownload') }}
        </template>
        <NcButton size="small" type="secondary" @click="downloadSvg">
          <template #icon>
            <GeneralIcon icon="download" class="w-4 h-4" />
          </template>
          {{ $t('general.download') }}
        </NcButton>
      </NcTooltip>
    </div>
  </div>
</template>
