<script lang="ts" setup>
import JsBarcode from 'jsbarcode'
import { IsGalleryInj, onMounted } from '#imports'
import { downloadSvg as _downloadSvg } from '~/utils/svgToPng'

const props = defineProps({
  barcodeValue: { type: String, required: true },
  barcodeFormat: { type: String, required: true },
  customStyle: { type: Object, required: false },
  showDownload: { type: Boolean, required: false, default: false },
})

const emit = defineEmits(['onClickBarcode'])

const isGallery = inject(IsGalleryInj, ref(false))

const barcodeSvgRef = ref<SVGGraphicsElement>()
const errorForCurrentInput = ref(false)

const generate = () => {
  try {
    JsBarcode(barcodeSvgRef.value, String(props.barcodeValue), {
      format: props.barcodeFormat,
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

const onBarcodeClick = (ev: MouseEvent) => {
  if (isGallery.value) return
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
      }"
      data-testid="barcode"
      @click="onBarcodeClick"
    ></svg>
    <slot v-if="errorForCurrentInput" name="barcodeRenderError" />
    <NcTooltip class="!absolute bottom-0 right-0">
      <template #title>
        {{ $t('labels.clickToDownload') }}
      </template>
      <NcButton v-if="props.showDownload" size="small" type="secondary" @click="downloadSvg">
        <GeneralIcon icon="download" class="w-4 h-4" />
      </NcButton>
    </NcTooltip>
  </div>
</template>
