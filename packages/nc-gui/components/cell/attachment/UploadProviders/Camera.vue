<script setup lang="ts">
import { useAttachmentCell } from '../utils'

const emits = defineEmits<{
  'update:visible': [value: boolean]
  'upload': [fileList: File[]]
}>()

const { isLoading, startCamera: _startCamera, stopCamera: _stopCamera, videoStream, permissionGranted } = useAttachmentCell()!

const { isMobileMode } = useGlobal()

const capturedImage = ref<null | File>(null)
const videoRef = ref<HTMLVideoElement | undefined>()
const canvasRef = ref<HTMLCanvasElement | undefined>()

const startCamera = async () => {
  try {
    await _startCamera()
    if (!videoRef.value || !videoStream.value) return
    videoRef.value.srcObject = videoStream.value
  } catch (error) {}
}

const stopCamera = () => {
  _stopCamera()
  if (videoRef.value) {
    videoRef.value.srcObject = null
  }
}

const retakeImage = () => {
  capturedImage.value = null
  startCamera()
}

const captureImage = () => {
  const video = videoRef.value
  const canvas = canvasRef.value

  if (!video || !canvas) return

  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const context = canvas.getContext('2d')

  if (context) {
    canvas.style.display = 'block'
    context.translate(canvas.width, 0)
    context.scale(-1, 1)
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (!blob) return
      capturedImage.value = new File([blob], `${new Date().toDateString()}.png`, { type: 'image/png' })
    }, 'image/png')
    stopCamera()
  }
}

const closeMenu = () => {
  emits('update:visible', false)
}

onMounted(() => {
  startCamera()
})

onBeforeUnmount(() => {
  stopCamera()
})
</script>

<template>
  <div class="w-full relative h-full">
    <NcTooltip class="absolute top-3 right-2">
      <NcButton type="text" class="!border-0" size="xsmall" @click="closeMenu">
        <GeneralIcon icon="close" />
      </NcButton>

      <template #title> {{ $t('general.close') }} </template>
    </NcTooltip>
    <div v-if="!permissionGranted" class="w-full h-full flex bg-gray-50 items-center justify-center">
      <div
        class="flex flex-col hover:bg-white p-2 cursor-pointer rounded-md !transition-all transition-ease-in-out duration-300 gap-2 items-center justify-center"
        @click="startCamera"
      >
        <div class="p-5 bg-white rounded-md shadow-sm">
          <mdi-camera class="text-4xl text-gray-800" />
        </div>
        <h1 class="text-gray-800 font-semibold text-center text-xl">
          {{ $t('labels.allowAccessToYourCamera') }}
        </h1>
      </div>
    </div>
    <div
      v-else
      :class="{
        'py-8': !capturedImage,
        'pt-8 pb-2': capturedImage,
      }"
      class="w-full gap-3 h-full flex-col flex items-center justify-between"
    >
      <div v-show="!capturedImage" class="w-full gap-3 h-full flex-col flex items-center justify-between">
        <video ref="videoRef" class="rounded-md" style="width: 400px" autoplay></video>

        <NcButton class="!rounded-full !px-0" @click="captureImage">
          <mdi-camera class="text-xl" />
        </NcButton>
      </div>

      <div v-show="capturedImage" class="flex group flex-col">
        <canvas ref="canvasRef" class="rounded-md mb-2" :class="isMobileMode ? 'w-[350px]' : 'w-[400px]'"></canvas>

        <div class="relative text-[12px] font-semibold text-gray-800 flex">
          <div class="flex-auto truncate line-height-4">
            {{ capturedImage?.name }}
          </div>
          <div class="flex-none hide-ui transition-all transition-ease-in-out !h-4 flex items-center bg-white">
            <NcTooltip placement="bottom">
              <template #title> {{ $t('title.removeFile') }} </template>
              <component :is="iconMap.delete" class="!text-red-500 cursor-pointer" @click="retakeImage" />
            </NcTooltip>
          </div>
        </div>
        <div class="flex-none text-[10px] font-semibold text-gray-500">
          {{ formatBytes(capturedImage?.size, 0) }}
        </div>
      </div>
      <div v-show="capturedImage" class="flex gap-2 pr-2 bottom-1 relative w-full items-center justify-end">
        <NcButton :disabled="isLoading" type="secondary" size="small" @click="closeMenu">
          {{ $t('labels.cancel') }}
        </NcButton>

        <NcButton :loading="isLoading" size="small" @click="emits('upload', [capturedImage] as File[])">
          <template v-if="!isLoading"> {{ $t('labels.uploadImage') }} </template>

          <template v-else> {{ $t('labels.uploading') }} </template>
        </NcButton>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
video {
  -webkit-transform: scaleX(-1);
  transform: scaleX(-1);
}
</style>
