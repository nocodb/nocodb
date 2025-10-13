<script setup lang="ts">
interface Props {
  hasImage?: boolean
  imageType: string
  containerClass?: string
  uploadButtonClass?: string
  deleteButtonClass?: string
  uploadTestId?: string
  deleteTestId?: string
  acceptedTypes?: string
  maxFileSize?: number // in MB
  uploadUrl?: string
}

interface Emits {
  (e: 'upload-success', url: string): void
  (e: 'upload-error', error: string): void
  (e: 'delete'): void
}

const props = withDefaults(defineProps<Props>(), {
  hasImage: false,
  containerClass: '',
  uploadButtonClass: '',
  deleteButtonClass: '',
  uploadTestId: '',
  deleteTestId: '',
  acceptedTypes: 'image/*',
  maxFileSize: 5, // 5MB default
  uploadUrl: '/api/upload',
})

const emit = defineEmits<Emits>()

const fileInput = ref<HTMLInputElement>()
const isUploading = ref(false)

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

const uploadFile = async (file: File): Promise<string> => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('type', props.imageType.toLowerCase())

  try {
    const response = await fetch(props.uploadUrl, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`)
    }

    const result = await response.json()

    // Assuming the API returns { url: "uploaded-file-url" }
    if (result.url) {
      return result.url
    } else {
      throw new Error('Invalid response from server')
    }
  } catch (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }
}

const handleFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  // Validate file
  const validationError = validateFile(file)
  if (validationError) {
    emit('upload-error', validationError)
    return
  }

  // Start upload
  isUploading.value = true

  try {
    const uploadedUrl = await uploadFile(file)
    emit('upload-success', uploadedUrl)
  } catch (error) {
    emit('upload-error', error.message)
  } finally {
    isUploading.value = false
    // Reset file input
    if (target) {
      target.value = ''
    }
  }
}

const handleDelete = () => {
  emit('delete')
}
</script>

<template>
  <div class="group relative" :class="containerClass">
    <!-- Default slot for rendering the current image/placeholder -->
    <slot name="content" />

    <!-- Upload controls overlay -->
    <div class="absolute bottom-0 right-0 hidden group-hover:block">
      <div class="flex items-center space-x-1 m-2">
        <NcButton
          type="secondary"
          size="small"
          :class="uploadButtonClass"
          :data-testid="uploadTestId"
          :loading="isUploading"
          @click="openFileDialog"
        >
          <div class="flex gap-2 items-center">
            <component :is="iconMap.upload" class="w-4 h-4" />
            <span>
              {{ hasImage ? $t('general.replace') : $t('general.upload') }}
              {{ imageType }}
            </span>
          </div>
        </NcButton>

        <NcTooltip v-if="hasImage">
          <template #title> {{ $t('general.delete') }} {{ imageType }} </template>
          <NcButton type="secondary" size="small" :class="deleteButtonClass" :data-testid="deleteTestId" @click="handleDelete">
            <div class="flex gap-2 items-center">
              <component :is="iconMap.delete" class="w-4 h-4" />
            </div>
          </NcButton>
        </NcTooltip>
      </div>
    </div>

    <!-- Hidden file input -->
    <input ref="fileInput" type="file" :accept="acceptedTypes" class="hidden" @change="handleFileSelect" />
  </div>
</template>
