<script lang="ts" setup>
import type { UploadChangeParam, UploadFile } from 'ant-design-vue'
import { message } from 'ant-design-vue'
import { ref, useDialog, useDropZone, useNuxtApp } from '#imports'
import DlgQuickImport from '~/components/dlg/QuickImport.vue'

const dropZone = ref<HTMLDivElement>()

const { isOverDropZone } = useDropZone(dropZone, onDrop)

const { $e } = useNuxtApp()

type QuickImportTypes = 'excel' | 'json' | 'csv'

const allowedQuickImportTypes = [
  // Excel
  '.xls, .xlsx, .xlsm, .ods, .ots',

  // CSV
  '.csv',

  // JSON
  '.json',
]

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
    const isAllowed = droppedFiles[0].type.replace('/', '.').endsWith(type)

    if (isAllowed) {
      fileType = type.replace('.', '') as QuickImportTypes
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

  const { close, vNode } = useDialog(DlgQuickImport, {
    'modelValue': isOpen,
    'importType': type,
    'onUpdate:modelValue': closeDialog,
  })

  vNode.value?.component?.exposed?.handleChange({
    file: { originFileObj: file },
    event: { percent: 100 },
  } as UploadChangeParam<UploadFile<File>>)

  function closeDialog() {
    isOpen.value = false
    close(1000)
  }
}
</script>

<template>
  <div ref="dropZone" class="h-full w-full text-gray-400 flex items-center justify-center relative">
    <general-overlay
      v-model="isOverDropZone"
      inline
      class="text-white text-3xl shadow-pink-500 shadow-inner bg-gray-700/75 flex items-center justify-center gap-2 backdrop-blur-xl"
    >
      <MaterialSymbolsFileCopyOutline class="text-pink-500" /> Drop here
    </general-overlay>

    <div class="flex flex-col gap-6 items-center justify-center md:w-1/2 mx-auto text-center">
      <div class="text-3xl">Welcome to NocoDB!</div>

      <div class="flex items-center flex-wrap justify-center gap-2 prose-lg leading-8">
        To get started, either drop a <span class="flex items-center gap-2"><PhFileCsv /> CSV</span>,
        <span class="flex items-center gap-2"><BiFiletypeJson /> JSON</span> or
        <span class="flex items-center gap-2"><BiFiletypeXlsx /> Excel</span> file here or click the button in the top-left of
        this page.
      </div>
    </div>
  </div>
</template>
