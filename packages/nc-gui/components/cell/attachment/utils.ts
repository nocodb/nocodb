import type { AttachmentReqType, AttachmentType } from 'nocodb-sdk'
import { populateUniqueFileName } from 'nocodb-sdk'
import DOMPurify from 'isomorphic-dompurify'
import RenameFile from './RenameFile.vue'
import MdiPdfBox from '~icons/mdi/pdf-box'
import MdiFileWordOutline from '~icons/mdi/file-word-outline'
import MdiFilePowerpointBox from '~icons/mdi/file-powerpoint-box'
import MdiFileExcelOutline from '~icons/mdi/file-excel-outline'
import IcOutlineInsertDriveFile from '~icons/ic/outline-insert-drive-file'

export const getReadableFileSize = (sizeInBytes: number) => {
  const i = Math.min(Math.floor(Math.log(sizeInBytes) / Math.log(1024)), 4)
  return `${(sizeInBytes / 1024 ** i).toFixed(2) * 1} ${['B', 'kB', 'MB', 'GB', 'TB'][i]}`
}

export const [useProvideAttachmentCell, useAttachmentCell] = useInjectionState(
  (updateModelValue: (data: string | Record<string, any>[]) => void) => {
    const { $api } = useNuxtApp()

    const baseURL = $api.instance.defaults.baseURL

    const { row } = useSmartsheetRowStoreOrThrow()

    const { fetchSharedViewAttachment } = useSharedView()

    const isReadonly = inject(ReadonlyInj, ref(false))

    const { t } = useI18n()

    const isPublic = inject(IsPublicInj, ref(false))

    const isForm = inject(IsFormInj, ref(false))

    const meta = inject(MetaInj, ref())

    const column = inject(ColumnInj, ref())

    const editEnabled = inject(EditModeInj, ref(false))

    /** keep user selected File object */
    const storedFiles = ref<AttachmentType[]>([])

    const attachments = ref<AttachmentType[]>([])

    const modalRendered = ref(false)

    const modalVisible = ref(false)

    /** for image carousel */
    const selectedFile = ref()

    const videoStream = ref<MediaStream | null>(null)

    const permissionGranted = ref(false)

    const { base } = storeToRefs(useBase())

    const { api, isLoading } = useApi()

    const { files, open } = useFileDialog({
      reset: true,
    })

    const isRenameModalOpen = ref(false)

    const { appInfo } = useGlobal()

    const defaultAttachmentMeta = {
      ...(appInfo.value.ee && {
        // Maximum Number of Attachments per cell
        maxNumberOfAttachments: Math.max(1, +appInfo.value.ncMaxAttachmentsAllowed || 50) || 50,
        // Maximum File Size per file
        maxAttachmentSize: Math.max(1, +appInfo.value.ncAttachmentFieldSize || 20) || 20,
        supportedAttachmentMimeTypes: ['*'],
      }),
    }

    const startCamera = async () => {
      if (!videoStream.value) {
        videoStream.value = await navigator.mediaDevices.getUserMedia({ video: true })
      }
      permissionGranted.value = true
    }

    const stopCamera = () => {
      videoStream.value?.getTracks().forEach((track) => track.stop())
      videoStream.value = null
    }

    /** our currently visible items, either the locally stored or the ones from db, depending on isPublic & isForm status */
    const visibleItems = computed<any[]>(() => (isPublic.value && isForm.value ? storedFiles.value : attachments.value))

    /** for bulk download */
    const selectedVisibleItems = ref<boolean[]>(Array.from({ length: visibleItems.value.length }, () => false))

    /** remove a file from our stored attachments (either locally stored or saved ones) */
    function removeFile(i: number) {
      if (isPublic.value) {
        storedFiles.value.splice(i, 1)
        attachments.value.splice(i, 1)
        selectedVisibleItems.value.splice(i, 1)

        updateModelValue(storedFiles.value)
      } else {
        attachments.value.splice(i, 1)
        selectedVisibleItems.value.splice(i, 1)

        updateModelValue(JSON.stringify(attachments.value))
      }
    }

    /** save a file on select / drop, either locally (in-memory) or in the db */
    async function onFileSelect(selectedFiles: FileList | File[], selectedFileUrls?: AttachmentReqType[]) {
      if (!selectedFiles.length && !selectedFileUrls?.length) return

      const attachmentMeta = {
        ...defaultAttachmentMeta,
        ...parseProp(column?.value?.meta),
      }

      const newAttachments: AttachmentType[] = []

      const files: File[] = []

      const imageUrls: AttachmentReqType[] = []

      for (const file of selectedFiles.length ? selectedFiles : selectedFileUrls || []) {
        if (appInfo.value.ee) {
          // verify number of files
          if (
            visibleItems.value.length + (selectedFiles.length || selectedFileUrls?.length || 0) >
            attachmentMeta.maxNumberOfAttachments
          ) {
            message.error(
              `You can only upload at most ${attachmentMeta.maxNumberOfAttachments} file${
                attachmentMeta.maxNumberOfAttachments > 1 ? 's' : ''
              } to this cell.`,
            )
            return
          }

          // verify file size
          if (file?.size && file.size > attachmentMeta.maxAttachmentSize) {
            message.error(
              `The size of ${
                (file as File)?.name || (file as AttachmentReqType)?.fileName
              } exceeds the maximum file size ${getReadableFileSize(attachmentMeta.maxAttachmentSize)}.`,
            )
            continue
          }

          // verify mime type
          if (
            !attachmentMeta.supportedAttachmentMimeTypes.includes('*') &&
            !attachmentMeta.supportedAttachmentMimeTypes.includes((file as File).type || (file as AttachmentReqType).mimetype) &&
            !attachmentMeta.supportedAttachmentMimeTypes.includes(
              ((file as File)?.type || (file as AttachmentReqType).mimetype)?.split('/')[0],
            )
          ) {
            message.error(
              `${(file as File)?.name || (file as AttachmentReqType)?.fileName} has the mime type ${
                (file as File)?.type || (file as AttachmentReqType)?.mimetype
              } which is not allowed in this column.`,
            )
            continue
          }
        }

        if (selectedFiles.length) {
          files.push(file as File)
        } else {
          const fileName = populateUniqueFileName(
            (file as AttachmentReqType).fileName ?? '',
            [...attachments.value, ...imageUrls].map((fn) => fn?.title || fn?.fileName),
            (file as File)?.type || (file as AttachmentReqType)?.mimetype || '',
          )

          imageUrls.push({ ...(file as AttachmentReqType), fileName, title: fileName })
        }
      }

      if (files.length && isPublic.value && isForm.value) {
        const newFiles = await Promise.all<AttachmentType>(
          Array.from(files).map(
            (file) =>
              new Promise<AttachmentType>((resolve) => {
                const res: { file: File; title: string; mimetype: string; data?: any } = {
                  ...file,
                  file,
                  title: file.name,
                  mimetype: file.type,
                }

                if (isImage(file.name, (<any>file).mimetype ?? file.type)) {
                  const reader = new FileReader()

                  reader.onload = (e) => {
                    res.data = e.target?.result
                    resolve(res)
                  }

                  reader.onerror = () => {
                    resolve(res)
                  }

                  reader.readAsDataURL(file)
                } else {
                  resolve(res)
                }
              }),
          ),
        )
        attachments.value = [...attachments.value, ...newFiles]

        return updateModelValue(attachments.value)
      } else if (isPublic.value && isForm.value) {
        attachments.value = [...attachments.value, ...imageUrls]

        return updateModelValue(attachments.value)
      }

      if (files.length) {
        try {
          const data = await api.storage.upload(
            {
              path: [NOCO, base.value.id, meta.value?.id, column.value?.id].join('/'),
            },
            {
              files,
            },
          )
          // add suffix in duplicate file title
          for (const uploadedFile of data) {
            newAttachments.push({
              ...uploadedFile,
              title: populateUniqueFileName(
                uploadedFile?.title,
                [...attachments.value, ...newAttachments].map((fn) => fn?.title || fn?.fileName),
                uploadedFile?.mimetype,
              ),
            })
          }
        } catch (e: any) {
          message.error(e.message || t('msg.error.internalError'))
        }
      } else if (imageUrls.length) {
        const data = uploadViaUrl(imageUrls)
        if (!data) return
        newAttachments.push(...data)
      }
      if (newAttachments?.length) updateModelValue(JSON.stringify([...attachments.value, ...newAttachments]))
    }

    async function uploadViaUrl(url: AttachmentReqType | AttachmentReqType[], returnError = false) {
      const imageUrl = Array.isArray(url) ? url : [url]
      try {
        const data = await api.storage.uploadByUrl(
          {
            path: [NOCO, base.value.id, meta.value?.id, column.value?.id].join('/'),
          },
          imageUrl,
        )
        return data
      } catch (e: any) {
        console.log(e)
        if (returnError) {
          return "File couldn't be uploaded. Verify URL & try again."
        }
        message.error("File couldn't be uploaded. Verify URL & try again.")
        return null
      }
    }

    async function renameFile(attachment: AttachmentType, idx: number, updateSelectedFile?: boolean) {
      return new Promise<boolean>((resolve) => {
        isRenameModalOpen.value = true
        const { close } = useDialog(RenameFile, {
          title: attachment.title,
          onRename: (newTitle: string) => {
            attachments.value[idx].title = newTitle
            updateModelValue(JSON.stringify(attachments.value))
            close()

            if (updateSelectedFile) {
              selectedFile.value = { ...attachment, title: newTitle }
            }

            isRenameModalOpen.value = false
            resolve(true)
          },
          onCancel: () => {
            close()
            isRenameModalOpen.value = false
            resolve(true)
          },
        })
      })
    }

    /** save files on drop */
    async function onDrop(droppedFiles: FileList | File[] | null, event: DragEvent) {
      if (isReadonly.value) return
      if (droppedFiles) {
        // set files
        await onFileSelect(droppedFiles)
      } else {
        event.preventDefault()

        // Sanitize the dataTransfer HTML string
        const sanitizedHtml = DOMPurify.sanitize(event.dataTransfer?.getData('text/html') ?? '') ?? ''

        const imageUrl = extractImageSrcFromRawHtml(sanitizedHtml) ?? ''

        if (!imageUrl) {
          message.error(t('msg.error.draggedContentIsNotTypeOfImage'))
          return
        }

        const imageData = (await getImageDataFromUrl(imageUrl)) as AttachmentReqType
        if (imageData?.mimetype) {
          await onFileSelect(
            [],
            [
              {
                ...imageData,
                url: imageUrl,
                fileName: `image.${imageData?.mimetype?.split('/')[1]}`,
                title: `image.${imageData?.mimetype?.split('/')[1]}`,
              },
            ],
          )
        } else {
          message.error(t('msg.error.fieldToParseImageData'))
        }
      }
    }

    /** bulk download selected files */
    async function bulkDownloadAttachments() {
      await Promise.all(selectedVisibleItems.value.map(async (v, i) => v && (await downloadAttachment(visibleItems.value[i]))))
      selectedVisibleItems.value = Array.from({ length: visibleItems.value.length }, () => false)
    }

    /** download a file */
    async function downloadAttachment(item: AttachmentType) {
      if (!meta.value || !column.value) return

      const modelId = meta.value.id
      const columnId = column.value.id
      const rowId = extractPkFromRow(unref(row).row, meta.value.columns!)
      const src = item.url || item.path
      if (modelId && columnId && rowId && src) {
        const apiPromise = isPublic.value
          ? () => fetchSharedViewAttachment(columnId, rowId, src)
          : () =>
              $api.dbDataTableRow.attachmentDownload(modelId, columnId, rowId, {
                urlOrPath: src,
              })

        await apiPromise().then((res) => {
          if (res?.path) {
            window.open(`${baseURL}/${res.path}`, '_blank')
          } else if (res?.url) {
            window.open(res.url, '_blank')
          } else {
            message.error('Failed to download file')
          }
        })
      } else {
        message.error('Failed to download file')
      }
    }

    async function getImageDataFromUrl(imageUrl: string) {
      try {
        const response = await fetch(imageUrl)
        if (response.ok) {
          if (response.headers.get('content-type')?.startsWith('image/')) {
            return {
              mimetype: response.headers.get('content-type') || undefined,
              size: +(response.headers.get('content-length') || 0) || undefined,
            } as { mimetype?: string; size?: number }
          } else if (imageUrl.slice(imageUrl.lastIndexOf('.') + 1).toLowerCase().length) {
            return {
              mimetype: `image/${imageUrl.slice(imageUrl.lastIndexOf('.') + 1).toLowerCase()}`,
              size: +(response.headers.get('content-length') || 0) || undefined,
            } as { mimetype?: string; size?: number }
          }
        }
      } catch (err) {
        console.log(err)
      }
    }

    const FileIcon = (icon: string) => {
      switch (icon) {
        case 'mdi-pdf-box':
          return MdiPdfBox
        case 'mdi-file-word-outline':
          return MdiFileWordOutline
        case 'mdi-file-powerpoint-box':
          return MdiFilePowerpointBox
        case 'mdi-file-excel-outline':
          return MdiFileExcelOutline
        default:
          return IcOutlineInsertDriveFile
      }
    }

    watch(files, (nextFiles) => nextFiles && onFileSelect(nextFiles))

    return {
      attachments,
      visibleItems,
      isPublic,
      isForm,
      isReadonly,
      meta,
      column,
      editEnabled,
      isLoading,
      api,
      open: () => open(),
      onDrop,
      modalRendered,
      modalVisible,
      FileIcon,
      removeFile,
      renameFile,
      downloadAttachment,
      updateModelValue,
      selectedFile,
      uploadViaUrl,
      selectedVisibleItems,
      storedFiles,
      bulkDownloadAttachments,
      defaultAttachmentMeta,
      startCamera,
      stopCamera,
      videoStream,
      permissionGranted,
      isRenameModalOpen,
    }
  },
  'useAttachmentCell',
)
