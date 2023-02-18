<script lang="ts" setup>
import type { UploadChangeParam, UploadFile } from 'ant-design-vue'
import {
  message,
  ref,
  resolveComponent,
  useDialog,
  useDropZone,
  useFileDialog,
  useNuxtApp,
  useProject,
  useUIPermission,
  watch,
} from '#imports'

const dropZone = ref<HTMLDivElement>()

const { isOverDropZone } = useDropZone(dropZone, onDrop)

const { files, open, reset } = useFileDialog()

const { bases, isSharedBase } = useProject()

const { isUIAllowed } = useUIPermission()

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
  $e(`a:actions:import-${type}`)

  const isOpen = ref(true)

  const { close, vNode } = useDialog(resolveComponent('DlgQuickImport'), {
    'modelValue': isOpen,
    'importType': type,
    'onUpdate:modelValue': closeDialog,
    'baseId': bases.value[0].id,
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

function openCreateTable() {
  const isOpen = ref(true)
  const { close } = useDialog(resolveComponent('DlgTableCreate'), {
    'modelValue': isOpen,
    'onUpdate:modelValue': closeDialog,
    'baseId': bases.value[0].id,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)

    reset()
  }
}

function onDropZoneClick(e: MouseEvent) {
  const elements = document.elementsFromPoint(e.clientX, e.clientY)
  const isCreateTableBtnClicked = elements.some((element) => element.classList.contains('create-table-btn'))

  if (isCreateTableBtnClicked) {
    openCreateTable()
    return
  }

  open()
}
</script>

<template>
  <div class="h-full w-full text-gray-600 flex items-center justify-center relative">
    <div
      v-if="isSharedBase || !isUIAllowed('dataInsert')"
      class="flex flex-col gap-6 items-center justify-center mx-auto text-center text-gray-500 border-gray-300 border-1 w-3/5 h-1/2 rounded-md"
    >
      <div class="text-3xl">Welcome to NocoDB!</div>

      <div class="prose-lg leading-8">To get started, click on a table in the left pane</div>
    </div>

    <div v-else ref="dropZone">
      <general-overlay
        :model-value="true"
        :class="[isOverDropZone ? 'bg-gray-300/75 border-primary shadow' : 'bg-gray-100/25 border-gray-500 cursor-pointer']"
        inline
        style="top: 20%; left: 20%; right: 20%; bottom: 20%"
        class="text-3xl flex items-center justify-center gap-2 border-1 border-dashed rounded hover:border-primary"
        @click="onDropZoneClick"
      >
        <template v-if="isOverDropZone"> <MaterialSymbolsFileCopyOutline class="text-accent" /> Drop here </template>
      </general-overlay>

      <div class="flex flex-col gap-6 items-center justify-center md:w-1/2 mx-auto text-center">
        <div class="text-3xl">Welcome to NocoDB!</div>

        <div class="flex items-center flex-wrap justify-center gap-2 prose-lg leading-8">
          To get started, either drop a <span class="flex items-center gap-2"><PhFileCsv /> CSV,</span>

          <span class="flex items-center gap-2"><BiFiletypeJson /> JSON</span> or

          <span class="flex items-center gap-2"><BiFiletypeXlsx /> Excel file here or</span>
        </div>

        <a-button type="primary" ghost class="create-table-btn">
          <span class="prose text-[1rem] text-primary z-50" @click.stop="openCreateTable">{{ $t('tooltip.addTable') }}</span>
        </a-button>
      </div>
    </div>
  </div>
</template>
