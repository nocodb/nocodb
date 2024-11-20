<script lang="ts" setup>
import { Cropper } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'
import 'vue-advanced-cropper/dist/theme.classic.css'
import type { AttachmentReqType } from 'nocodb-sdk'
import type { ImageCropperConfig } from '~/lib/types'

interface Props {
  imageConfig: {
    src: string
    type: string
    name: string
  }
  cropperConfig: ImageCropperConfig
  uploadConfig?: {
    path?: string
  }
  showCropper: boolean
}
const { imageConfig, cropperConfig, uploadConfig, ...props } = defineProps<Props>()
const emit = defineEmits(['update:showCropper', 'submit'])

const showCropper = useVModel(props, 'showCropper', emit)

const { api, isLoading } = useApi()

const cropperRef = ref()

const previewImage = ref({
  canvas: {},
  src: '',
})

const handleCropImage = () => {
  const { canvas } = cropperRef.value.getResult()
  previewImage.value = {
    canvas,
    src: canvas.toDataURL(),
  }
}

const handleUploadImage = async (fileToUpload: AttachmentReqType[]) => {
  if (uploadConfig?.path) {
    try {
      const uploadResult = await api.storage.uploadByUrl(
        {
          path: uploadConfig?.path as string,
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
    ;(previewImage.value.canvas as any).toBlob(async (blob: Blob) => {
      await handleUploadImage([
        {
          title: imageConfig.name,
          fileName: imageConfig.name,
          mimetype: imageConfig.type,
          size: blob.size,
          url: previewImage.value.src,
          data: previewImage.value.src,
        },
      ])
    }, imageConfig.type)
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
        :image-restriction="cropperConfig?.imageRestriction"
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

        <NcButton size="small" :loading="isLoading" :disabled="!previewImage.src" @click="handleSaveImage"> Save </NcButton>
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
