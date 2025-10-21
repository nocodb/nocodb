<script setup lang="ts">
import type { AttachmentReqType, PublicAttachmentScope } from 'nocodb-sdk'
import type { UploadFile } from 'ant-design-vue'
import { useProvideUploadState } from './UploadProviders/useUploadState'

interface Props {
  disabled?: boolean
  multiple?: boolean
  accept?: string
  maxSize?: number // in MB
  enabledProviders?: ('local' | 'url' | 'webcam')[]
  uploadPath?: string
  uploadScope?: PublicAttachmentScope
}

interface Emits {
  (e: 'upload', attachments: AttachmentReqType[]): void
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  multiple: false,
  accept: '*',
  maxSize: undefined,
  enabledProviders: () => ['local', 'url', 'webcam'],
  uploadPath: '',
  uploadScope: undefined,
})

const emit = defineEmits<Emits>()

const { batchUploadFiles } = useAttachment()

const { base } = storeToRefs(useBase())

const showModal = ref(false)

const uploadedFiles = ref<UploadFile[]>([])

const handleRemove = (file: UploadFile) => {
  uploadedFiles.value = uploadedFiles.value.filter((f) => f.uid !== file.uid)
}

const openModal = () => {
  showModal.value = true
}

const closeModalFn = () => {
  showModal.value = false
}

const handleModalUpload = async (files: File[]) => {
  const uploadPath = props.uploadPath || [NOCO, base.value?.id].filter(Boolean).join('/')

  const uploadResult = await batchUploadFiles([...files], uploadPath)

  const newFiles = uploadResult.map((attachment, index) => ({
    uid: `${Date.now()}-${attachment.title}`,
    name: attachment.title || files[index].name,
    status: 'done' as const,
    size: attachment.size || files[index].size,
    type: attachment.mimetype || files[index].type,
    originFileObj: files[index],
    url: attachment.url,
  }))

  if (props.multiple) {
    uploadedFiles.value.push(...newFiles)
  } else {
    uploadedFiles.value = newFiles
  }

  // Emit uploaded attachments
  emit('upload', uploadResult)
  showModal.value = false
}

const handleAttachmentUpload = async (attachments: any[]) => {
  const newFiles = attachments.map((attachment) => ({
    uid: `${Date.now()}-${attachment.title}`,
    name: attachment.title,
    status: 'done' as const,
    size: attachment.size,
    type: attachment.mimetype,
    url: attachment.url || attachment.path,
  }))

  if (props.multiple) {
    uploadedFiles.value.push(...newFiles)
  } else {
    uploadedFiles.value = newFiles
  }

  // Emit uploaded attachments
  emit('upload', attachments)
  showModal.value = false
}

// Provide upload state to modal and all providers
const uploadPath = computed(() => props.uploadPath || [NOCO, base.value?.id].filter(Boolean).join('/'))
useProvideUploadState(handleModalUpload, handleAttachmentUpload, closeModalFn, uploadPath.value, props.uploadScope)
</script>

<template>
  <div class="nc-file-upload flex flex-col gap-2">
    <!-- Trigger slot - customizable button/trigger -->
    <div>
      <slot name="trigger" @click="openModal">
        <NcButton size="small" :disabled="disabled" type="secondary">
          <div class="flex gap-2 items-center">
            <GeneralIcon icon="upload" />
            Click to Upload
          </div>
        </NcButton>
      </slot>
    </div>

    <!-- File list display -->
    <div v-if="uploadedFiles.length > 0" class="flex flex-col gap-2">
      <slot name="file-list" :files="uploadedFiles" :remove="handleRemove" :format-bytes="formatBytes">
        <!-- Default file list rendering -->
        <div
          v-for="file in uploadedFiles"
          :key="file.uid"
          class="border-1 border-nc-border-gray-medium bg-nc-bg-default flex items-center pl-1 py-2 pr-2 rounded-xl group"
        >
          <CellAttachmentIconView class="w-10 h-10" :item="{ title: file.name, mimetype: file.type }" />
          <div class="flex flex-col flex-1 min-w-0 px-2">
            <div class="text-caption text-nc-content-gray">
              <NcTooltip class="!max-w-[200px] truncate" show-on-truncate-only>
                {{ file.name }}
                <template #title>
                  {{ file.name }}
                </template>
              </NcTooltip>
            </div>
            <div class="text-caption text-nc-content-gray-muted">
              {{ formatBytes(file.size || 0) }}
            </div>
          </div>
          <NcButton
            v-if="!disabled"
            type="text"
            size="xsmall"
            class="!opacity-0 group-hover:!opacity-100 transition-opacity"
            @click="handleRemove(file)"
          >
            <GeneralIcon icon="delete" class="text-red-500" />
          </NcButton>
        </div>
      </slot>

      <!-- Add more button for multiple uploads -->
      <div v-if="multiple" @click="openModal">
        <slot name="add-more">
          <NcButton size="small" :disabled="disabled" type="text">
            <div class="flex gap-2 items-center">
              <GeneralIcon icon="plus" />
              Add More Files
            </div>
          </NcButton>
        </slot>
      </div>
    </div>

    <!-- Upload Modal -->
    <NcFileUploadModal v-model:visible="showModal" :enabled-providers="enabledProviders" />
  </div>
</template>

<style lang="scss" scoped>
.nc-file-upload {
  :deep(.ant-upload) {
    width: 100%;
  }
}
</style>
