<script setup lang="ts">
import type { ChatAttachmentType } from 'nocodb-sdk'

interface ChatFileChip {
  file: ChatAttachmentType
  status: 'uploading' | 'done' | 'error'
}

interface Props {
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const emit = defineEmits<{
  send: [content: string, files: ChatAttachmentType[]]
  cancel: []
}>()

const { disabled } = toRefs(props)

const { t } = useI18n()

const { batchUploadFiles } = useAttachment()

const inputValue = ref('')

const textareaRef = ref<HTMLTextAreaElement>()

const fileInputRef = ref<HTMLInputElement>()

const fileChips = ref<ChatFileChip[]>([])

const ACCEPTED_EXTENSIONS = '.csv,.pdf,.json,.txt,.md,.xlsx,.xls'

const ACCEPTED_SET = new Set(ACCEPTED_EXTENSIONS.split(','))

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const MAX_FILES = 5

const isUploading = computed(() => fileChips.value.some((c) => c.status === 'uploading'))

const readyFiles = computed(() => fileChips.value.filter((c) => c.status === 'done').map((c) => c.file))

const canSend = computed(() => {
  return inputValue.value.trim().length > 0 && !disabled.value && !isUploading.value
})

const uploadFiles = async (fileList: FileList | File[]) => {
  const files = Array.from(fileList)

  if (fileChips.value.length + files.length > MAX_FILES) {
    message.warning(`Maximum ${MAX_FILES} files allowed`)
    return
  }

  const validFiles = files.filter((f) => {
    const ext = f.name.includes('.') ? `.${f.name.split('.').pop()?.toLowerCase()}` : ''
    if (!ext || !ACCEPTED_SET.has(ext)) {
      message.warning(`${f.name} is not a supported file type`)
      return false
    }
    if (f.size > MAX_FILE_SIZE) {
      message.warning(`${f.name} exceeds 10MB limit`)
      return false
    }
    return true
  })

  if (!validFiles.length) return

  // Add placeholder chips immediately
  const startIndex = fileChips.value.length
  const fileCount = validFiles.length
  for (const file of validFiles) {
    fileChips.value.push({
      file: {
        title: file.name,
        mimetype: file.type,
        size: file.size,
      },
      status: 'uploading',
    })
  }

  const uploaded = await batchUploadFiles([...validFiles], 'chat')

  if (uploaded.length) {
    for (let i = 0; i < uploaded.length; i++) {
      const att = uploaded[i]
      const chip = fileChips.value[startIndex + i]
      if (chip) {
        chip.file = {
          ...chip.file,
          mimetype: chip.file.mimetype || att.mimetype || '',
          path: att.path,
          url: att.url,
          signedPath: att.signedPath,
          signedUrl: att.signedUrl,
          icon: att.icon,
        }
        chip.status = 'done'
      }
    }
  } else {
    // batchUploadFiles returns [] on error — mark all as failed
    for (let i = 0; i < fileCount; i++) {
      const chip = fileChips.value[startIndex + i]
      if (chip) {
        chip.status = 'error'
      }
    }
  }
}

const handleFileSelect = async (e: Event) => {
  const input = e.target as HTMLInputElement
  if (input.files?.length) {
    await uploadFiles(input.files)
  }
  // Reset input so same file can be re-selected
  input.value = ''
}

const removeFile = (index: number) => {
  fileChips.value.splice(index, 1)
}

const handleSubmit = () => {
  if (!canSend.value) return

  emit('send', inputValue.value.trim(), [...readyFiles.value])
  inputValue.value = ''
  fileChips.value = []

  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
      textareaRef.value.focus()
    }
  })
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSubmit()
  }
}

const handlePaste = async (e: ClipboardEvent) => {
  const files = Array.from(e.clipboardData?.files || [])
  if (files.length) {
    e.preventDefault()
    await uploadFiles(files)
  }
}

const hasFiles = computed(() => fileChips.value.length > 0)

const fileNames = computed(() => fileChips.value.map((c) => c.file.title))

defineExpose({ uploadFiles, hasFiles, fileNames })

watch(disabled, (newVal, oldVal) => {
  if (oldVal && !newVal) {
    nextTick(() => {
      textareaRef.value?.focus()
    })
  }
})
</script>

<template>
  <div class="nc-chat-input px-4 py-3">
    <div
      class="nc-chat-input-box relative border-1 rounded-lg overflow-hidden transition-colors shadow-default focus-within:shadow-selected"
      :class="[
        disabled
          ? 'border-nc-border-gray-medium opacity-50 !shadow-none'
          : 'border-nc-border-gray-medium focus-within:border-nc-fill-primary',
      ]"
    >
      <div class="nc-chat-files-wrapper" :class="{ 'is-visible': fileChips.length }">
        <div class="flex items-center gap-2 px-3 pt-2.5 overflow-x-auto nc-scrollbar-x-thin min-h-0">
          <TransitionGroup name="nc-chip">
            <div
              v-for="(chip, index) in fileChips"
              :key="chip.file.title + index"
              class="nc-chat-file-chip flex items-center gap-2 pl-2 pr-1 py-1.5 rounded-lg border-1 border-nc-border-gray-light bg-nc-bg-gray-extralight flex-none max-w-52"
            >
              <div class="w-9 h-9 flex-none flex items-center justify-center">
                <GeneralLoader v-if="chip.status === 'uploading'" size="regular" />
                <GeneralIcon v-else :icon="getAttachmentIcon(chip.file.title, chip.file.mimetype)" class="w-9 h-9" />
              </div>

              <div class="flex flex-col min-w-0 flex-1">
                <NcTooltip :title="chip.file.title" show-on-truncate-only class="truncate leading-tight">
                  <span class="text-small text-nc-content-gray-emphasis">
                    {{ chip.file.title }}
                  </span>
                </NcTooltip>
                <span
                  class="text-captionSm leading-tight"
                  :class="chip.status === 'error' ? 'text-nc-content-red-dark' : 'text-nc-content-gray-subtle'"
                >
                  {{ chip.status === 'error' ? 'Upload failed' : getFileTypeLabel(chip.file.title, chip.file.mimetype) }}
                </span>
              </div>

              <NcButton size="xxsmall" type="text" class="flex-none !rounded-md" @click="removeFile(index)">
                <GeneralIcon icon="close" class="w-3.5 h-3.5" />
              </NcButton>
            </div>
          </TransitionGroup>
        </div>
      </div>

      <textarea
        ref="textareaRef"
        v-model="inputValue"
        :placeholder="t('placeholder.askAnything')"
        :disabled="disabled"
        class="nc-chat-textarea w-full resize-none rounded-lg px-3 pb-10 text-body bg-transparent text-nc-content-gray-emphasis placeholder:text-nc-content-gray-subtle nc-scrollbar-thin"
        :class="fileChips.length ? 'pt-2' : ''"
        rows="2"
        @keydown.stop="handleKeyDown"
        @paste.stop="handlePaste"
      />

      <div class="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <div>
          <NcButton
            v-if="!disabled"
            v-e="['c:chat:attach-file']"
            size="small"
            type="text"
            class="!rounded-md"
            :disabled="fileChips.length >= MAX_FILES"
            @click="fileInputRef?.click()"
          >
            <GeneralIcon icon="ncPlus" class="w-4 h-4" />
          </NcButton>
          <input
            ref="fileInputRef"
            type="file"
            :accept="ACCEPTED_EXTENSIONS"
            multiple
            class="hidden"
            @change="handleFileSelect"
          />
        </div>
        <div>
          <NcButton
            v-if="disabled"
            v-e="['c:chat:cancel-sending']"
            size="small"
            type="secondary"
            class="flex-none"
            @click="emit('cancel')"
          >
            <GeneralIcon icon="ncStopCircle" class="w-4 h-4" />
          </NcButton>

          <NcButton
            v-else
            v-e="['c:chat:send-message']"
            size="small"
            type="primary"
            class="flex-none"
            :disabled="!canSend"
            :loading="isUploading"
            @click="handleSubmit"
          >
            <GeneralIcon icon="ncSendHorizontal" class="w-4 h-4" />
          </NcButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-chat-files-wrapper {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 150ms linear;

  > div {
    min-height: 0;
    overflow: hidden;
  }

  &.is-visible {
    grid-template-rows: 1fr;
  }
}

.nc-chip-enter-active,
.nc-chip-leave-active {
  transition: opacity 150ms linear, transform 150ms linear;
}

.nc-chip-enter-from {
  opacity: 0;
  transform: scale(0.9);
}

.nc-chip-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.nc-chat-textarea {
  outline: none !important;
  box-shadow: none !important;
  border: none !important;
  min-height: 52px;
  max-height: 160px;
}
</style>
