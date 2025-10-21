import type { InjectionKey, Ref } from 'vue'
import type { AttachmentReqType, PublicAttachmentScope } from 'nocodb-sdk'

export interface UploadState {
  isLoading: Ref<boolean>
  tempFiles: Ref<File[]>
  uploadPath: Ref<string>
  uploadScope: Ref<PublicAttachmentScope | undefined>
  addFiles: (files: File[]) => void
  removeFile: (index: number) => void
  clearFiles: () => void
  upload: () => Promise<void>
  uploadAttachments: (attachments: AttachmentReqType[]) => Promise<void>
  closeModal: () => void
}

export const UploadStateKey: InjectionKey<UploadState> = Symbol('upload-state')

export const useProvideUploadState = (
  onUpload: (files: File[]) => Promise<void>,
  onUploadAttachments: (attachments: AttachmentReqType[]) => Promise<void>,
  onClose: () => void,
  path: string,
  scope?: PublicAttachmentScope,
) => {
  const isLoading = ref(false)
  const tempFiles = ref<File[]>([])
  const uploadPath = ref(path)
  const uploadScope = ref(scope)

  const addFiles = (files: File[]) => {
    tempFiles.value.push(...files)
  }

  const removeFile = (index: number) => {
    tempFiles.value.splice(index, 1)
  }

  const clearFiles = () => {
    tempFiles.value = []
  }

  const upload = async () => {
    if (tempFiles.value.length === 0) return

    try {
      isLoading.value = true
      await onUpload(tempFiles.value)
      // Clear files after successful upload
      tempFiles.value = []
    } finally {
      isLoading.value = false
    }
  }

  const uploadAttachments = async (attachments: AttachmentReqType[]) => {
    if (attachments.length === 0) return

    try {
      isLoading.value = true
      await onUploadAttachments(attachments)
    } finally {
      isLoading.value = false
    }
  }

  const closeModal = () => {
    onClose()
  }

  const state: UploadState = {
    isLoading,
    tempFiles,
    uploadPath,
    uploadScope,
    addFiles,
    removeFile,
    clearFiles,
    upload,
    uploadAttachments,
    closeModal,
  }

  provide(UploadStateKey, state)

  return state
}

export const useUploadState = () => {
  const state = inject(UploadStateKey)

  if (!state) {
    throw new Error('useUploadState must be used within a provider')
  }

  return state
}
