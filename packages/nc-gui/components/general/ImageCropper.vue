<script lang="ts" setup>
import { Cropper } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'
import 'vue-advanced-cropper/dist/theme.classic.css'
import type { AttachmentReqType, PublicAttachmentScope } from 'nocodb-sdk'
import type { ImageCropperConfig } from '#imports'

interface Props {
  imageConfig: {
    src: string
    type: string
    name: string
  }
  cropperConfig: ImageCropperConfig
  uploadConfig?: {
    path?: string
    scope?: PublicAttachmentScope
    // filesize in bytes
    maxFileSize?: number
  }
  showCropper: boolean
}
const { imageConfig, uploadConfig, ...props } = defineProps<Props>()
const emit = defineEmits(['update:showCropper', 'submit'])

const showCropper = useVModel(props, 'showCropper', emit)

const { cropperConfig } = toRefs(props)

const imageRestriction = computed(() => {
  return cropperConfig.value.imageRestriction || 'fit-area'
})

const { api, isLoading } = useApi()

const cropperRef = ref()

const previewImage = ref({
  canvas: {},
  src: '',
})

const fileSize = ref<number>(0)

const isValidFileSize = computed(() => {
  return !!(fileSize.value && fileSize.value * 1.33 <= (uploadConfig?.maxFileSize || 3 * 1024 * 1024))
})

const handleCropImage = () => {
  const { canvas } = cropperRef.value.getResult()
  previewImage.value = {
    canvas,
    src: canvas.toDataURL(imageConfig.type),
  }
  ;(canvas as any).toBlob((blob: Blob) => {
    fileSize.value = blob.size
  }, imageConfig.type)
}

const handleUploadImage = async (fileToUpload: AttachmentReqType[]) => {
  if (uploadConfig?.path) {
    try {
      const uploadResult = await api.storage.uploadByUrl(
        {
          path: uploadConfig?.path as string,
          scope: uploadConfig?.scope,
        },
        fileToUpload,
      )
      if (uploadResult?.[0]) {
        emit('submit', {
          ...uploadResult[0],
          data: fileToUpload[0].data,
        })
      } else {
        emit('submit', fileToUpload[0])
      }
    } catch (error: any) {
      console.error(error)
      message.error(await extractSdkResponseErrorMsg(error))
    }
  } else {
    emit('submit', fileToUpload[0])
  }

  showCropper.value = false
}

const handleSaveImage = async () => {
  if (previewImage.value.canvas) {
    await handleUploadImage([
      {
        title: imageConfig.name,
        fileName: imageConfig.name,
        mimetype: imageConfig.type,
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

watch(showCropper, () => {
  if (!showCropper.value) {
    previewImage.value = {
      canvas: {},
      src: '',
    }
  }
})
</script>

<template>
  <NcModal v-model:visible="showCropper" :mask-closable="false" wrap-class-name="!z-1050">
    <div class="nc-image-cropper-wrapper relative">
      <Cropper
        ref="cropperRef"
        class="nc-cropper relative"
        :src="imageConfig.src"
        :auto-zoom="true"
        :stencil-props="cropperConfig?.stencilProps || {}"
        :min-height="cropperConfig?.minHeight"
        :min-width="cropperConfig?.minWidth"
        :image-restriction="imageRestriction"
        v-bind="
          cropperConfig.stencilProps?.fillDefault || cropperConfig.stencilProps?.fillDefault === undefined ? { defaultSize } : {}
        "
      />
      <div v-if="previewImage.src" class="result_preview">
        <img :src="previewImage.src" alt="Preview Image" />
      </div>
    </div>
    <div class="flex justify-between items-center space-x-4 mt-4">
      <div class="flex items-center space-x-4">
        <NcButton type="secondary" size="small" :disabled="isLoading" @click="showCropper = false"> Cancel </NcButton>
      </div>
      <div class="flex items-center space-x-4">
        <NcButton type="secondary" size="small" :disabled="isLoading" @click="handleCropImage">
          <GeneralIcon icon="crop"></GeneralIcon>
          <span class="ml-2">Crop</span>
        </NcButton>

        <NcTooltip :disabled="isValidFileSize">
          <template #title> Cropped file size is greter than max file size </template>

          <NcButton size="small" :loading="isLoading" :disabled="!previewImage.src || !isValidFileSize" @click="handleSaveImage">
            Save
          </NcButton>
        </NcTooltip>
      </div>
    </div>
  </NcModal>
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
