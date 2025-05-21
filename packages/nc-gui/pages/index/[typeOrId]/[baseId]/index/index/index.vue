<script lang="ts" setup>
import type { UploadChangeParam, UploadFile } from 'ant-design-vue'
import type { SourceType } from 'nocodb-sdk'

const baseStore = useBase()
const { base, sources } = storeToRefs(baseStore)

const { isMobileMode } = useGlobal()

const { files, reset } = useFileDialog()

const { $e } = useNuxtApp()

type QuickImportTypes = 'excel' | 'json' | 'csv'

const allowedQuickImportTypes = [
  // Excel
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel.sheet.macroenabled.12', // .xlsm
  'application/vnd.oasis.opendocument.spreadsheet', // .ods
  'application/vnd.oasis.opendocument.spreadsheet-template', // .ots

  // CSV
  'text/csv',

  // JSON
  'application/json',
  'text/json',
]

watch(files, (nextFiles) => nextFiles && onFileSelect(nextFiles), { flush: 'post' })

function onFileSelect(fileList: FileList | null) {
  if (!fileList) return

  const files = Array.from(fileList).map((file) => file)

  onDrop(files)
}

function onDrop(droppedFiles: File[] | null) {
  if (!droppedFiles) return

  /** we can only handle one file per drop */
  if (droppedFiles.length > 1) {
    return message.error({
      content: `Only one file can be imported at a time.`,
      duration: 2,
    })
  }

  let fileType: QuickImportTypes | null = null
  const isValid = allowedQuickImportTypes.some((type) => {
    const isAllowed = droppedFiles[0].type === type

    if (isAllowed) {
      const ext = droppedFiles[0].name.split('.').pop()
      fileType = ext === 'csv' || ext === 'json' ? ext : ('excel' as QuickImportTypes)
    }

    return isAllowed
  })

  /** Invalid file type was dropped */
  if (!isValid) {
    return message.error({
      content: 'Invalid file type',
      duration: 2,
    })
  }

  if (fileType && isValid) {
    openQuickImportDialog(fileType, droppedFiles[0])
  }
}

function openQuickImportDialog(type: QuickImportTypes, file: File) {
  if (!base.value?.id) return

  $e(`a:actions:import-${type}`)

  const isOpen = ref(true)

  const { close, vNode } = useDialog(resolveComponent('DlgQuickImport'), {
    'modelValue': isOpen,
    'importType': type,
    'onUpdate:modelValue': closeDialog,
    'baseId': base.value.id,
    'sourceId': sources.value?.filter((source: SourceType) => source.enabled)[0].id,
  })

  vNode.value?.component?.exposed?.handleChange({
    file: {
      uid: `${type}-${file.name}-${Math.random().toString(36).substring(2)}`,
      name: file.name,
      type: file.type,
      status: 'done',
      fileName: file.name,
      lastModified: file.lastModified,
      size: file.size,
      originFileObj: file,
    },
    event: { percent: 100 },
  } as UploadChangeParam<UploadFile<File>>)

  function closeDialog() {
    isOpen.value = false

    close(1000)

    reset()
  }
}

watch(
  () => base.value?.id,
  () => {
    if (base.value?.id && base.value.type === 'database') {
      const { addTab } = useTabs()

      addTab({
        id: base.value.id,
        title: base.value.title!,
        type: TabType.DB,
        baseId: base.value.id,
      })
    }
  },
)
</script>

<template>
  <ProjectView v-if="!isMobileMode" />
</template>
