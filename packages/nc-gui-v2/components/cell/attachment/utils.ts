import { message } from 'ant-design-vue'
import FileSaver from 'file-saver'
import { computed, inject, ref, useApi, useFileDialog, useInjectionState, useProject, watch } from '#imports'
import { ColumnInj, EditModeInj, IsPublicInj, MetaInj, ReadonlyInj } from '~/context'
import { isImage } from '~/utils'
import { NOCO } from '~/lib'
import MdiPdfBox from '~icons/mdi/pdf-box'
import MdiFileWordOutline from '~icons/mdi/file-word-outline'
import MdiFilePowerpointBox from '~icons/mdi/file-powerpoint-box'
import MdiFileExcelOutline from '~icons/mdi/file-excel-outline'
import IcOutlineInsertDriveFile from '~icons/ic/outline-insert-drive-file'


interface AttachmentProps {
  data?: any
  file: File
  title: string
}

export const [useProvideAttachmentCell, useAttachmentCell] = useInjectionState(
  (updateModelValue: (data: string | Record<string, any>[]) => void) => {
    const isReadonly = inject(ReadonlyInj, false)

    const isPublic = inject(IsPublicInj, ref(false))

    const isForm = inject('isForm', false)

    // todo: replace placeholder var
    const isPublicGrid = $ref(false)

    const meta = inject(MetaInj)!

    const column = inject(ColumnInj)!

    const editEnabled = inject(EditModeInj, ref(false))

    // todo: refactor name
    const storedFiles = ref<{ title: string; file: File }[]>([])

    const storedFilesRefs = ref<File[]>([])

    const attachments = ref<File[]>([])

    const modalVisible = ref(false)

    const selectedImage = ref()

    const { project } = useProject()

    const { api, isLoading } = useApi()

    const { files, open } = useFileDialog()

    /** remove a file from our stored attachments (either locally stored or saved ones) */
    function removeFile(i: number) {
      if (isPublic.value) {
        storedFiles.value.splice(i, 1)
        storedFilesRefs.value.splice(i, 1)

        updateModelValue(storedFiles.value.map((storedFile) => storedFile.file))
      } else {
        attachments.value.splice(i, 1)
        updateModelValue(attachments.value)
      }
    }

    /** save a file on select / drop, either locally (in-memory) or in the db */
    async function onFileSelect(selectedFiles: FileList | File[]) {
      if (!selectedFiles.length || isPublicGrid) return

      if (isPublic.value) {
        storedFilesRefs.value.push(...selectedFiles)
        storedFiles.value.push(
          ...(await Promise.all<AttachmentProps>(
            Array.from(selectedFiles).map(
              (file) =>
                new Promise<AttachmentProps>((resolve) => {
                  const res: AttachmentProps = { file, title: file.name }
                  if (isImage(file.name, (file as any).mimetype)) {
                    const reader = new FileReader()
                    reader.onload = (e: any) => {
                      res.data = e.target?.result
                      resolve(res)
                    }
                    reader.onerror = () => {
                      resolve(res)
                    }
                    reader.readAsDataURL(file)
                  }
                }),
            ),
          )),
        )

        return updateModelValue(storedFiles.value.map((storedFile) => storedFile.file))
      }

      const newAttachments = []

      for (const file of selectedFiles) {
        try {
          const data = await api.storage.upload(
            {
              path: [NOCO, project.value.title, meta.value.title, column.value.title].join('/'),
            },
            {
              files: file,
              json: '{}',
            },
          )

          newAttachments.push(...data)
        } catch (e: any) {
          message.error(e.message || 'Some internal error occurred')
        }
      }

      updateModelValue([...attachments.value, ...newAttachments])
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
      FileSaver.saveAs(item.url || item.data, item.title)
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

    /** our currently visible items, either the locally stored or the ones from db, depending on isPublicForm status */
    const visibleItems = computed<any[]>(() => (isPublic.value ? storedFiles.value : attachments.value) || ([] as any[]))

    watch(files, (nextFiles) => nextFiles && onFileSelect(nextFiles))

    return {
      attachments,
      storedFiles,
      visibleItems,
      isPublic,
      isForm,
      isPublicGrid,
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
      storedFilesRefs
    }
  },
  'useAttachmentCell',
)
