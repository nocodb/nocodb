import type { AttachmentType } from 'nocodb-sdk'

/**
 * CE stub — attaching files to comments is an EE/paid feature. In CE the UI is
 * never rendered (`isCommentAttachmentsEnabled` is false) and every action is a
 * no-op. The EE implementation lives in `ee/composables/useCommentAttachments.ts`.
 */
export function useCommentAttachments() {
  const isCommentAttachmentsEnabled = computed(() => false)

  const pendingAttachments = ref<AttachmentType[]>([])

  const isUploading = ref(false)

  const openFilePicker = () => {}

  const handlePaste = (_e: ClipboardEvent) => {}

  const handleDrop = (_e: DragEvent) => {}

  const uploadFiles = async (_files: File[] | FileList) => {}

  const removeAttachment = (_index: number) => {}

  const clearAttachments = () => {
    pendingAttachments.value = []
  }

  return {
    isCommentAttachmentsEnabled,
    pendingAttachments,
    isUploading,
    openFilePicker,
    handlePaste,
    handleDrop,
    uploadFiles,
    removeAttachment,
    clearAttachments,
  }
}
