import {
  ColumnInj,
  EditModeInj,
  IsFormInj,
  IsPublicInj,
  MetaInj,
  NOCO,
  ReadonlyInj,
  computed,
  inject,
  isImage,
  message,
  ref,
  useApi,
  useFileDialog,
  useI18n,
  useInjectionState,
  useProject,
  watch,
} from '#imports'
import MdiPdfBox from '~icons/mdi/pdf-box'
import MdiFileWordOutline from '~icons/mdi/file-word-outline'
import MdiFilePowerpointBox from '~icons/mdi/file-powerpoint-box'
import MdiFileExcelOutline from '~icons/mdi/file-excel-outline'
import IcOutlineInsertDriveFile from '~icons/ic/outline-insert-drive-file'

interface AttachmentProps extends File {
  data?: any
  file: File
  title: string
  mimetype: string
}

export const [useProvideAttachmentCell, useAttachmentCell] = useInjectionState(
  (updateModelValue: (data: string | Record<string, any>[]) => void) => {
    const isReadonly = inject(ReadonlyInj, false)

    const isPublic = inject(IsPublicInj, ref(false))

    const isForm = inject(IsFormInj, ref(false))

    const meta = inject(MetaInj, ref())

    const column = inject(ColumnInj, ref())

    const editEnabled = inject(EditModeInj, ref(false))

    /** keep user selected File object */
    const storedFiles = ref<AttachmentProps[]>([])

    const attachments = ref<File[]>([])

    const modalVisible = ref(false)

    const selectedImage = ref()

    const { project } = useProject()

    const { api, isLoading } = useApi()

    const { files, open } = useFileDialog()

    const { t } = useI18n()

    /** remove a file from our stored attachments (either locally stored or saved ones) */
    function removeFile(i: number) {
      if (isPublic.value) {
        storedFiles.value.splice(i, 1)

        updateModelValue(storedFiles.value.map((stored) => stored.file))
      } else {
        attachments.value.splice(i, 1)

        updateModelValue(attachments.value)
      }
    }

    /** save a file on select / drop, either locally (in-memory) or in the db */
    async function onFileSelect(selectedFiles: FileList | File[]) {
      if (!selectedFiles.length) return

      if (isPublic.value && isForm.value) {
        const newFiles = await Promise.all<AttachmentProps>(
          Array.from(selectedFiles).map(
            (file) =>
              new Promise<AttachmentProps>((resolve) => {
                const res: AttachmentProps = { ...file, file, title: file.name, mimetype: file.type }

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
      }

      const newAttachments = []

      for (const file of selectedFiles) {
        try {
          const data = await api.storage.upload(
            {
              path: [NOCO, project.value.title, meta.value?.title, column.value?.title].join('/'),
            },
            {
              files: file,
              json: '{}',
            },
          )

          newAttachments.push(...data)
        } catch (e: any) {
          message.error(e.message || t('msg.error.internalError'))
        }
      }

      updateModelValue(JSON.stringify([...attachments.value, ...newAttachments]))
    }

    /** save files on drop */
    async function onDrop(droppedFiles: File[] | null) {
      if (droppedFiles) {
        // set files
        await onFileSelect(droppedFiles)
      }
    }

    /** download a file */
    async function downloadFile(item: Record<string, any>) {
      ;(await import('file-saver')).saveAs(item.url || item.data, item.title)
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

    /** our currently visible items, either the locally stored or the ones from db, depending on isPublic & isForm status */
    const visibleItems = computed<any[]>(() => (isPublic.value && isForm.value ? storedFiles.value : attachments.value))

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
      modalVisible,
      FileIcon,
      removeFile,
      downloadFile,
      updateModelValue,
      selectedImage,
      storedFiles,
    }
  },
  'useAttachmentCell',
)
