<script setup lang="ts">
import { Cropper } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'
import 'vue-advanced-cropper/dist/theme.classic.css'
import type { AttachmentReqType } from 'nocodb-sdk'
import type { ImageCropperConfig } from '#imports'

interface Props {
  attachment?: AttachmentReqType | null
  containerClass?: string
  acceptedTypes?: string
  maxFileSize?: number // in MB
  uploadPath?: string
  uploadScope?: string
}

interface Emits {
  (e: 'update:attachment', url: AttachmentReqType): void
}

const props = withDefaults(defineProps<Props>(), {
  containerClass: '',
  acceptedTypes: 'image/*',
  maxFileSize: 5,
  uploadPath: '',
  uploadScope: undefined,
})

const emit = defineEmits<Emits>()

const attachment = useVModel(props, 'attachment', emit)

const { api, isLoading } = useApi()

const fileInput = ref<HTMLInputElement>()
const showCropper = ref(false)
const cropperRef = ref()

const previewImage = ref({
  canvas: {},
  src: '',
})

const fileSize = ref<number>(0)

const isValidFileSize = computed(() => {
  return props.maxFileSize ? !!fileSize.value && fileSize.value <= props.maxFileSize * 1024 * 1024 : true
})

const imageCropperData = ref<{
  imageConfig: {
    src: string
    type: string
    name: string
  }
  cropperConfig: ImageCropperConfig
  uploadConfig?: {
    path?: string
    scope?: string
    maxFileSize?: number
  }
  cropFor: 'banner' | 'logo' | 'icon'
}>({
  imageConfig: {
    src: '',
    type: '',
    name: '',
  },
  cropperConfig: {
    stencilProps: {},
    minHeight: 0,
    minWidth: 0,
    imageRestriction: 'fit-area',
  },
  uploadConfig: {
    path: '',
    scope: undefined,
    maxFileSize: undefined,
  },
  cropFor: 'icon',
})

const imageRestriction = computed(() => {
  return imageCropperData.value.cropperConfig.imageRestriction || 'fit-area'
})

const openFileDialog = () => {
  fileInput.value?.click()
}

const validateFile = (file: File): string | null => {
  // Check file size
  if (file.size > props.maxFileSize * 1024 * 1024) {
    return `File size must be less than ${props.maxFileSize}MB`
  }

  // Check file type
  if (props.acceptedTypes !== '*' && !file.type.match(props.acceptedTypes.replace('*', '.*'))) {
    return 'Invalid file type'
  }

  return null
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = target.files

  if (files && files[0]) {
    const file = files[0]

    // Validate file
    const validationError = validateFile(file)

    if (validationError) {
      message.error('Please upload a valid image')
      return
    }

    // Setup upload config
    imageCropperData.value.uploadConfig = {
      path: props.uploadPath,
      scope: props.uploadScope,
      maxFileSize: props.maxFileSize * 1024 * 1024,
    }

    imageCropperData.value.cropperConfig = {
      ...imageCropperData.value.cropperConfig,
      stencilProps: {
        aspectRatio: 1,
      },
      minHeight: 150,
      minWidth: 150,
    }
    imageCropperData.value.cropFor = 'icon'

    if (imageCropperData.value.imageConfig.src) {
      URL.revokeObjectURL(imageCropperData.value.imageConfig.src)
    }

    // Create new blob
    const blob = URL.createObjectURL(file)

    imageCropperData.value.imageConfig = {
      src: blob,
      type: file.type,
      name: file.name,
    }

    showCropper.value = true
  }
}

const handleCropImage = () => {
  const { canvas } = cropperRef.value.getResult()

  if (!canvas) return

  previewImage.value = {
    canvas,
    src: canvas.toDataURL(imageCropperData.value.imageConfig.type),
  }
  ;(canvas as any).toBlob((blob: Blob) => {
    fileSize.value = blob.size
  }, imageCropperData.value.imageConfig.type)
}

const handleUploadImage = async (fileToUpload: AttachmentReqType[]) => {
  try {
    const uploadResult = await api.storage.uploadByUrl(
      {
        path: props.uploadPath,
        scope: props.uploadScope,
      },
      fileToUpload,
    )

    attachment.value = uploadResult?.[0]
  } catch (error: any) {
    console.error(error)
    message.error(await extractSdkResponseErrorMsg(error))
  }

  showCropper.value = false
}

const handleSaveImage = async () => {
  if (previewImage.value.canvas) {
    await handleUploadImage([
      {
        title: imageCropperData.value.imageConfig.name,
        fileName: imageCropperData.value.imageConfig.name,
        mimetype: imageCropperData.value.imageConfig.type,
        size: fileSize.value,
        url: previewImage.value.src,
        data: previewImage.value.src,
      },
    ])
  }
}

const defaultSize = ({ imageSize, visibleArea }: { imageSize: Record<string, any>; visibleArea: Record<string, any> }) => {
  return {
    width: (visibleArea || imageSize).width,
    height: (visibleArea || imageSize).height,
  }
}

const handleDelete = () => {
  emit('update:attachment', null)
}

watch(
  showCropper,
  () => {
    if (!showCropper.value) {
      previewImage.value = {
        canvas: {},
        src: '',
      }
    } else {
      until(() => !!cropperRef.value?.getResult?.()?.canvas)
        .toBeTruthy({ timeout: 2000 })
        .then((canvas) => {
          if (!canvas) return

          nextTick(() => {
            handleCropImage()
          })
        })
    }
  },
  {
    immediate: true,
  },
)

onUnmounted(() => {
  if (imageCropperData.value.imageConfig.src) {
    URL.revokeObjectURL(imageCropperData.value.imageConfig.src)
  }
})
</script>

<template>
  <div class="relative" :class="containerClass">
    <!-- Cropper Modal -->
    <NcModal v-if="showCropper" v-model:visible="showCropper" :mask-closable="false" wrap-class-name="!z-1050">
      <div class="nc-image-cropper-wrapper relative">
        <Cropper
          ref="cropperRef"
          class="nc-cropper relative"
          :src="imageCropperData.imageConfig.src"
          :auto-zoom="true"
          :stencil-props="imageCropperData.cropperConfig?.stencilProps || {}"
          :min-height="imageCropperData.cropperConfig?.minHeight"
          :min-width="imageCropperData.cropperConfig?.minWidth"
          :image-restriction="imageRestriction"
          v-bind="
            imageCropperData.cropperConfig.stencilProps?.fillDefault ||
            imageCropperData.cropperConfig.stencilProps?.fillDefault === undefined
              ? { defaultSize }
              : {}
          "
        />
        <div
          v-if="previewImage.src"
          class="result_preview"
          :class="{
            'rounded-full overflow-hidden': imageCropperData.cropperConfig?.stencilProps?.circlePreview,
          }"
        >
          <img :src="previewImage.src" alt="Preview Image" />
        </div>
      </div>
      <div class="flex justify-between items-center mt-4 space-x-4">
        <div class="flex items-center space-x-4">
          <NcButton type="secondary" size="small" :disabled="isLoading" @click="showCropper = false"> Cancel </NcButton>
        </div>
        <div class="flex items-center space-x-4">
          <NcButton type="secondary" size="small" :disabled="isLoading" @click="handleCropImage">
            <GeneralIcon icon="crop"></GeneralIcon>
            <span class="ml-2">Crop</span>
          </NcButton>

          <NcTooltip :disabled="isValidFileSize">
            <template #title> Cropped file size is greater than max file size </template>

            <NcButton
              size="small"
              :loading="isLoading"
              :disabled="!previewImage.src || !isValidFileSize"
              @click="handleSaveImage"
            >
              Save
            </NcButton>
          </NcTooltip>
        </div>
      </div>
    </NcModal>

    <slot name="content" />

    <div
      :class="{
        'mt-4': attachment,
      }"
      class="flex items-center gap-2"
    >
      <NcButton type="secondary" size="small" @click="openFileDialog">
        <div class="flex gap-2 items-center">
          <component :is="iconMap.upload" class="w-4 h-4" />
          <span>
            {{ attachment ? $t('general.replace') : $t('general.upload') }}
            Icon
          </span>
        </div>
      </NcButton>

      <NcButton v-if="attachment" type="secondary" size="small" @click="handleDelete">
        <div class="flex gap-2 items-center">
          <component :is="iconMap.delete" class="w-4 h-4" />
          <span>{{ $t('general.delete') }}</span>
        </div>
      </NcButton>
    </div>

    <input ref="fileInput" type="file" :accept="acceptedTypes" class="!hidden" @change="handleFileSelect" />
  </div>
</template>

<style lang="scss" scoped>
.nc-cropper {
  min-height: 400px;
  max-height: 400px;
}
.nc-image-cropper-wrapper {
  .result_preview {
    @apply absolute right-4 bottom-4 border-1 border-dashed border-white/50 w-28 h-28 opacity-90 pointer-events-none;
    img {
      @apply w-full h-full object-contain;
    }
  }
}
</style>
