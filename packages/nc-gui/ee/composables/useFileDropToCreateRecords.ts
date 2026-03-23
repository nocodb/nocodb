import type { AttachmentType, ColumnType, TableType, ViewType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import type { Row } from '#imports'
import { NOCO } from '~/lib/constants'

interface UseFileDropToCreateRecordsOptions {
  meta: Ref<TableType | undefined>
  /** Creates an empty row in the cache and returns it. Does NOT save to server. */
  callAddEmptyRow?: (
    newRowIndex?: number,
    metaValue?: TableType,
    rowOverwrite?: Record<string, any>,
    path?: Array<number>,
  ) => Row | undefined
  /** Saves or updates a row on the server */
  updateOrSaveRow: (
    row: Row,
    property?: string,
    ltarState?: Record<string, any>,
    args?: { metaValue?: TableType; viewMetaValue?: ViewType },
    beforeRow?: string,
    path?: Array<number>,
  ) => Promise<any>
}

function extractFilenameWithoutExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  return lastDot > 0 ? filename.substring(0, lastDot) : filename
}

export function useFileDropToCreateRecords(options: UseFileDropToCreateRecordsOptions) {
  const { meta, callAddEmptyRow, updateOrSaveRow } = options

  const { t } = useI18n()
  const { base } = storeToRefs(useBase())
  const { appInfo } = useGlobal()
  const { batchUploadFiles } = useAttachment()

  const isProcessing = ref(false)
  const showFieldSelectDlg = ref(false)
  const pendingFiles = ref<File[]>([])

  /** Non-system attachment columns available in the current table */
  const attachmentFields = computed<ColumnType[]>(() => {
    if (!meta.value?.columns) return []
    return meta.value.columns.filter((col) => col.uidt === UITypes.Attachment && !col.system)
  })

  /**
   * Validates a file against the attachment column's configured limits:
   * max file size and allowed MIME types. Mirrors the checks in useAttachmentCell.
   * Returns an error message string if invalid, or null if the file is acceptable.
   */
  const validateFile = (file: File, columnMeta: Record<string, any>): string | null => {
    if (!appInfo.value.ee) return null

    const maxSize = columnMeta.maxAttachmentSize
    if (file.size && maxSize && file.size > maxSize) {
      return t('msg.error.fileTooLarge', {
        name: file.name,
        size: getReadableFileSize(maxSize),
      })
    }

    const allowedTypes: string[] = columnMeta.supportedAttachmentMimeTypes || ['*']
    if (!allowedTypes.includes('*') && !allowedTypes.includes(file.type) && !allowedTypes.includes(file.type?.split('/')[0])) {
      return t('msg.error.fileTypeNotAllowed', { name: file.name, type: file.type })
    }

    return null
  }

  /**
   * Core logic: validate files, upload in a single batch, then create one record per file.
   *
   * Upload-first strategy avoids stale row references — insertRow replaces the cached
   * row object after server insert, so any ref held before save becomes stale.
   * By uploading first and passing attachment JSON via `rowOverwrite`, each row is
   * created and saved in a single call with complete data.
   */
  const processFilesWithField = async (files: File[], attachmentColumn: ColumnType) => {
    if (!meta.value?.id || !callAddEmptyRow || isProcessing.value) return
    if (!attachmentColumn.title) return

    isProcessing.value = true

    try {
      const defaultMeta = {
        ...(appInfo.value.ee && {
          maxAttachmentSize: Math.max(1, +appInfo.value.ncAttachmentFieldSize || 20) || 20,
          supportedAttachmentMimeTypes: ['*'],
        }),
      }
      const columnMeta = { ...defaultMeta, ...parseProp(attachmentColumn.meta) }

      // Step 1: Validate all files before uploading any
      const validFiles: File[] = []
      for (const file of files) {
        const error = validateFile(file, columnMeta)
        if (error) {
          message.error(error)
        } else {
          validFiles.push(file)
        }
      }

      if (!validFiles.length) {
        return
      }

      message.loading(t('msg.info.uploadingFiles', { count: validFiles.length }))

      // Step 2: Upload all files in a single batch call (batchUploadFiles chunks internally by 10)
      // Pass a copy because batchUploadFiles uses splice() which mutates the input array
      const uploadPath = [NOCO, base.value?.id, meta.value.id, attachmentColumn.id].join('/')
      const uploadedFiles = await batchUploadFiles([...validFiles], uploadPath)

      message.destroy()

      // batchUploadFiles returns [] and shows its own error toast on failure
      if (!uploadedFiles?.length) {
        return
      }

      // Step 3: Create one record per uploaded file
      let successCount = 0
      let failCount = 0

      for (let i = 0; i < uploadedFiles.length; i++) {
        const uploaded: AttachmentType = uploadedFiles[i]
        const originalFile = validFiles[i]

        try {
          const rowOverwrite: Record<string, any> = {}

          // Populate display field with filename (sans extension) when it's a text column
          const displayField = meta.value?.columns?.find((col) => col.pv)
          if (displayField?.title && [UITypes.SingleLineText, UITypes.LongText].includes(displayField.uidt as UITypes)) {
            rowOverwrite[displayField.title] = extractFilenameWithoutExtension(originalFile.name)
          }

          rowOverwrite[attachmentColumn.title] = JSON.stringify([uploaded])

          const newRow = callAddEmptyRow(undefined, meta.value, rowOverwrite, [])
          if (!newRow) {
            failCount++
            continue
          }

          await updateOrSaveRow(newRow, undefined, undefined, undefined, undefined, [])
          successCount++
        } catch {
          failCount++
        }
      }

      if (successCount > 0) {
        message.toast(
          successCount === 1
            ? t('msg.toast.nRecordCreated', { n: successCount })
            : t('msg.toast.nRecordsCreated', { n: successCount }),
        )
      }

      if (failCount > 0) {
        message.error(t('msg.error.failedToCreateRecords', { count: failCount }))
      }
    } catch {
      message.destroy()
      message.error(t('msg.error.failedToCreateRecords', { count: files.length }))
    } finally {
      isProcessing.value = false
    }
  }

  /**
   * Main entry point: called when files are dropped on the bottom drop zone.
   * Routes to either auto-select (single attachment field) or shows a picker dialog.
   */
  const handleFileDrop = (files: File[]) => {
    if (!files.length || !meta.value || !appInfo.value.ee) return

    const fields = attachmentFields.value

    if (fields.length === 0) {
      message.error(t('msg.error.noAttachmentFields'))
      return
    }

    if (fields.length === 1) {
      processFilesWithField(files, fields[0])
    } else {
      pendingFiles.value = files
      showFieldSelectDlg.value = true
    }
  }

  /** Called when user selects a field from the multi-field selection dialog */
  const onFieldSelected = (field: ColumnType) => {
    const files = pendingFiles.value
    pendingFiles.value = []
    showFieldSelectDlg.value = false
    processFilesWithField(files, field)
  }

  /** Called when user cancels the field selection dialog */
  const onFieldSelectCancelled = () => {
    pendingFiles.value = []
    showFieldSelectDlg.value = false
  }

  return {
    isProcessing: readonly(isProcessing),
    showFieldSelectDlg,
    pendingFiles: readonly(pendingFiles),
    attachmentFields,
    handleFileDrop,
    onFieldSelected,
    onFieldSelectCancelled,
  }
}
