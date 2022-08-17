<script lang="ts" setup>
import { ref, useDialog, useDropZone, useNuxtApp } from '#imports'
import DlgQuickImport from '~/components/dlg/QuickImport.vue'

const el = ref<HTMLDivElement>()

const { isOverDropZone } = useDropZone(el, onDrop)

const { $e } = useNuxtApp()

function onDrop(droppedFiles: File[] | null) {
  console.log('onDrop', droppedFiles)
}

function openQuickImportDialog(type: string) {
  $e(`a:actions:import-${type}`)

  const { close } = useDialog(DlgQuickImport, {
    'modelValue': true,
    'importType': type,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    close(1000)
  }
}
</script>

<template>
  <div ref="el" class="h-full w-full text-gray-400 flex items-center justify-center relative">
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
        <span class="flex items-center gap-2"><BiFiletypeXlsx /> Excel</span> file in here or click the button in the top-left of
        this page.
      </div>
    </div>
  </div>
</template>
