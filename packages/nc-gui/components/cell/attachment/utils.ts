import type { AttachmentReqType, AttachmentType } from 'nocodb-sdk'
import { populateUniqueFileName } from 'nocodb-sdk'
import DOMPurify from 'isomorphic-dompurify'
import { zip as fflateZip } from 'fflate'
import RenameFile from './RenameFile.vue'
import MdiPdfBox from '~icons/nc-icons-v2/file-type-pdf'
import MdiFileWordOutline from '~icons/nc-icons-v2/file-type-word'
import MdiFilePowerpointBox from '~icons/nc-icons-v2/file-type-presentation'
import MdiFileExcelOutline from '~icons/nc-icons-v2/file-type-csv'
import IcOutlineInsertDriveFile from '~icons/nc-icons-v2/file-type-unknown'

export const [useProvideAttachmentCell, useAttachmentCell] = useInjectionState(
  (updateModelValue: (data: string | Record<string, any>[]) => void) => {
    const { $api } = useNuxtApp()

    const { isUIAllowed } = useRoles()

    const baseURL = $api.instance.defaults.baseURL

    const { isSharedForm } = useSmartsheetStoreOrThrow()

    const { row } = useSmartsheetRowStoreOrThrow()

    const { fetchSharedViewAttachment } = useSharedView()

    const isReadonly = inject(ReadonlyInj, ref(false))

    const { t } = useI18n()

    const isPublic = inject(IsPublicInj, ref(false))

    const isForm = inject(IsFormInj, ref(false))

    const meta = inject(MetaInj, ref())

    const column = inject(ColumnInj, ref())

    const editEnabled = inject(EditModeInj, ref(false))

    const isEditAllowed = computed(() => (!isPublic.value && !isReadonly.value && isUIAllowed('dataEdit')) || isSharedForm.value)

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

        updateModelValue(attachments.value)
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
      if (newAttachments?.length) updateModelValue([...attachments.value, ...newAttachments])
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

    function updateAttachmentTitle(idx: number, title: string) {
      attachments.value[idx]!.title = title
      updateModelValue(attachments.value)
    }

    async function renameFile(attachment: AttachmentType, idx: number, updateSelectedFile?: boolean) {
      return new Promise<boolean>((resolve) => {
        isRenameModalOpen.value = true
        const { close } = useDialog(RenameFile, {
          title: attachment.title,
          onRename: (newTitle: string) => {
            updateAttachmentTitle(idx, newTitle)
            close()

            if (updateSelectedFile) {
              selectedFile.value = { ...attachment }
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

    async function renameFileInline(idx: number, newTitle: string, updateSelectedFile?: boolean) {
      updateAttachmentTitle(idx, newTitle)

      if (updateSelectedFile) {
        selectedFile.value = { ...attachments.value[idx] }
      }

      isRenameModalOpen.value = false
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
      const items: AttachmentType[] = selectedVisibleItems.value
        .map((v, i) => (v ? visibleItems.value[i] : undefined))
        .filter(Boolean)

      if (items.length === 0) return
      if (items.length === 1) {
        return downloadAttachment(items[0]!)
      }

      if (!meta.value || !column.value) return
      const modelId = meta.value.id
      const columnId = column.value.id
      const rowId = extractPkFromRow(unref(row).row, meta.value.columns!)

      if (!modelId || !columnId || !rowId) {
        console.error('Missing modelId, columnId or rowId')
        message.error('Failed to download file')
      }

      const filesData: { name: string; data: Uint8Array }[] = []

      for (const item of items) {
        const src = item.url || item.path
        if (!src) {
          console.error('Missing src')
          message.error('Failed to download file')
          continue
        }

        const apiPromise = isPublic.value
          ? () => fetchSharedViewAttachment(columnId!, rowId!, src)
          : () =>
              $api.dbDataTableRow.attachmentDownload(modelId!, columnId!, rowId!, {
                urlOrPath: src,
              })

        const res = await apiPromise()
        if (!res) {
          console.error('Invalid response')
          message.error('Failed to download file')
          continue
        }

        let response: Response
        if (res.path) {
          response = await fetch(`${baseURL}/${res.path}`)
        } else if (res.url) {
          response = await fetch(`${res.url}`)
        } else {
          console.error('Invalid blob response')
          message.error('Failed to download file')
          continue
        }

        const arrayBuffer = await response.arrayBuffer()
        const fileName = item.title || src.split('/').pop() || 'file'

        filesData.push({
          name: fileName,
          data: new Uint8Array(arrayBuffer),
        })
      }

      if (filesData.length === 0) {
        message.error('No files to download')
        return
      }

      // Create a zip object
      const zip: Record<string, Uint8Array> = {}

      // Add files to zip object
      filesData.forEach(({ name, data }) => {
        zip[name] = data
      })

      try {
        // Use fflate to create zip
        const zipData = await new Promise<Uint8Array>((resolve, reject) => {
          fflateZip(zip, (err, data) => {
            if (err) {
              reject(err)
            } else {
              resolve(data)
            }
          })
        })

        // Create blob and download
        const blob = new Blob([zipData], { type: 'application/zip' })
        const zipURL = URL.createObjectURL(blob)

        try {
          window.open(zipURL, '_self')
        } catch (e) {
          console.error('Error opening blob window', e)
          message.error('Failed to download file')
          return undefined
        } finally {
          setTimeout(() => URL.revokeObjectURL(zipURL), 1000)
        }
      } catch (e) {
        console.error('Error creating zip file', e)
        message.error('Failed to create zip file')
      }
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
            window.open(`${baseURL}/${res.path}`, '_self')
          } else if (res?.url) {
            window.open(res.url, '_self')
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
      renameFileInline,
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
      updateAttachmentTitle,
      isEditAllowed,
    }
  },
  'useAttachmentCell',
)
