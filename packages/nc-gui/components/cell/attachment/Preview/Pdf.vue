<script setup lang="ts">
import PDFObject from 'pdfobject'

interface Props {
  src: string[]
  class?: string
}

const props = defineProps<Props>()

const emits = defineEmits(['error'])

const currentIndex = ref(0)

// iOS / iPadOS Safari and most mobile browsers can't render PDFs inline
const supportsInlinePdf = PDFObject.supportsPDFs

const handleError = async () => {
  if (currentIndex.value < props.src.length - 1) {
    currentIndex.value = currentIndex.value + 1
  } else {
    const isURLExp = await isURLExpired(props.src[0])
    if (isURLExp.isExpired) {
      emits('error')
    }
    currentIndex.value = 0
  }
}
</script>

<template>
  <pdf-object v-if="supportsInlinePdf" :class="props.class" :url="src[currentIndex]" class="w-full h-full" @error="handleError" />
  <LazyCellAttachmentPreviewPdfJs v-else :class="props.class" :src="src" @error="emits('error')" />
</template>
