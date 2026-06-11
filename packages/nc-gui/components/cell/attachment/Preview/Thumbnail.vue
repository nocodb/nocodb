<script setup lang="ts">
import MdiPdfBox from '~icons/nc-icons-v2/file-type-pdf'
import MdiFileWordOutline from '~icons/nc-icons-v2/file-type-word'
import MdiFilePowerpointBox from '~icons/nc-icons-v2/file-type-presentation'
import MdiFileExcelOutline from '~icons/nc-icons-v2/file-type-csv'
import IcOutlineInsertDriveFile from '~icons/nc-icons-v2/file-type-unknown'

interface Props {
  alt?: string
  objectFit?: string
  isCellPreview?: boolean
  imageClass?: string
  thumbnail?: 'card_cover' | 'tiny' | 'small'
  attachment: Record<string, any>
  iconWidth?: number
  iconHeight?: number
}

const props = withDefaults(defineProps<Props>(), {
  isCellPreview: true,
  imageClass: '',
  iconWidth: 45,
  iconHeight: 45,
})

const emit = defineEmits(['error'])

const { getPossibleAttachmentSrc } = useAttachment()

const FileIcon = (icon: string) => {
  switch (icon) {
    case 'mdi-pdf-box':
      return MdiPdfBox
    case 'mdi-file-word-outline':
      return MdiFileWordOutline
    case 'mdi-file-powerpoint-box':
      return MdiFilePowerpointBox
    case 'mdi-file-excel-outline':
      return MdiFileExcelOutline
    default:
      return IcOutlineInsertDriveFile
  }
}

const srcs = computed(() => {
  return getPossibleAttachmentSrc(props.attachment, props.thumbnail)
})

const index = ref(0)

const onError = async () => {
  index.value++
  if (index.value >= srcs.value.length) {
    const isURLExp = await isURLExpired(srcs.value[0])
    if (isURLExp.isExpired) {
      emit('error')
    }
  }
}
</script>

<template>
  <div class="relative h-full w-full">
    <div
      ref="containerRef"
      class="h-full w-full overflow-hidden"
      :class="{
        'flex items-center justify-center': index >= srcs?.length,
      }"
    >
      <img
        v-if="index < srcs?.length"
        ref="imageRef"
        :src="srcs[index]"
        :alt="props?.alt || ''"
        :class="[imageClass, { '!object-contain': props.objectFit === 'contain' }]"
        class="m-auto h-full max-h-full w-auto nc-attachment-image object-cover origin-center"
        loading="lazy"
        @error="onError"
      />

      <component
        :is="FileIcon(attachment.icon)"
        v-else-if="attachment.icon"
        :height="iconHeight"
        :width="iconWidth"
        class="text-white"
      />

      <GeneralIcon
        v-else
        class="text-white"
        :icon="getAttachmentIcon(attachment.title, attachment.mimetype)"
        :height="iconHeight"
        :width="iconWidth"
      />
    </div>
  </div>
</template>
