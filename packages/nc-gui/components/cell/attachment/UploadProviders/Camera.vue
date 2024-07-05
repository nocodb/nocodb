<script setup lang="ts">
const emits = defineEmits<{
  'update:visible': [value: boolean]
  'upload': [fileList: File[]]
}>()

const permissionGranted = ref(false)
const capturedImage = ref<null | File>(null)
const videoRef = ref<HTMLVideoElement | undefined>()
const canvasRef = ref<HTMLCanvasElement | undefined>()

const startCamera = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    if (videoRef.value) {
      videoRef.value.srcObject = stream
    }
  } catch (error) {
    console.error('Error starting camera:', error)
  }
}

const retakeImage = () => {
  capturedImage.value = null
  startCamera()
}

const stopCamera = () => {
  if (videoRef.value && videoRef.value.srcObject) {
    const stream = videoRef.value.srcObject as MediaStream
    const tracks = stream.getTracks()
    tracks.forEach((track) => {
      track.stop()
    })
    videoRef.value.srcObject = null
  }
}

const requestPermission = async () => {
  try {
    await navigator.mediaDevices.getUserMedia({ video: true })
    permissionGranted.value = true
    await startCamera()
  } catch (error) {
    console.error('Error requesting camera permission:', error)
  }
}

const checkPermission = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    if (stream.getVideoTracks().length > 0) {
      permissionGranted.value = true
      await startCamera()
    } else {
      await requestPermission()
    }
    stream.onaddtrack = () => {
      permissionGranted.value = true
      startCamera()
    }
  } catch (error) {
    console.error('Error checking camera permission:', error)
  }
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
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (!blob) return
      capturedImage.value = new File([blob], `${new Date().toDateString()}.png`, { type: 'image/png' })
    }, 'image/png')
    stopCamera()
  }
}

onMounted(() => {
  checkPermission()
})
</script>

<template>
  <div class="w-full h-full">
    <div v-if="!permissionGranted" class="w-full h-full flex bg-gray-50 items-center justify-center">
      <div
        class="flex flex-col hover:bg-white p-2 cursor-pointer rounded-md !transition-all transition-ease-in-out duration-300 gap-2 items-center justify-center"
        @click="checkPermission"
      >
        <div class="p-5 bg-white rounded-md shadow-sm">
          <mdi-camera class="text-4xl text-gray-800" />
        </div>
        <h1 class="text-gray-800 font-semibold text-center text-xl">Please allow access to your camera</h1>
      </div>
    </div>
    <div v-else class="w-full gap-3 h-full flex-col flex items-center justify-between py-2">
      <template v-if="!capturedImage">
        <video ref="videoRef" class="pt-4" style="width: 400px" autoplay></video>

        <NcButton class="!rounded-full !px-0" @click="captureImage">
          <mdi-camera class="text-xl" />
        </NcButton>
      </template>

      <div v-show="capturedImage" class="flex group flex-col gap-1">
        <canvas ref="canvasRef" class="pt-4" style="width: 400px; display: none"></canvas>

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
          {{ formatBytes(capturedImage?.size, 2) }}
        </div>
      </div>
      <div v-show="capturedImage" class="flex gap-2 pr-2 w-full items-center justify-end">
        <NcButton type="secondary" size="small" @click="emits('update:visible', false)"> Cancel </NcButton>

        <NcButton size="small" @click="emits('upload', [capturedImage] as File[])"> Upload image </NcButton>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
