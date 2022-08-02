<script setup lang="ts">
import { notification } from 'ant-design-vue'
import { computed, inject, ref, useApi, useDropZone, useFileDialog, useProject, watch } from '#imports'
import { ColumnInj, EditModeInj, MetaInj } from '~/context'
import { NOCO } from '~/lib'
import { isImage, openLink } from '~/utils'
import MaterialSymbolsAttachFile from '~icons/material-symbols/attach-file'
import MaterialArrowExpandIcon from '~icons/mdi/arrow-expand'
import MaterialSymbolsFileCopyOutline from '~icons/material-symbols/file-copy-outline'
import MdiReload from '~icons/mdi/reload'
import IcOutlineInsertDriveFile from '~icons/ic/outline-insert-drive-file'
import MdiPdfBox from '~icons/mdi/pdf-box'
import MdiFileWordOutline from '~icons/mdi/file-word-outline'
import MdiFilePowerpointBox from '~icons/mdi/file-powerpoint-box'
import MdiFileExcelOutline from '~icons/mdi/file-excel-outline'

interface Props {
  modelValue: string | Record<string, any>[] | null
}

interface Emits {
  (event: 'update:modelValue', value: string | Record<string, any>): void
}

const { modelValue } = defineProps<Props>()

const emits = defineEmits<Emits>()

const isPublicForm = inject('isPublicForm', false)

const isForm = inject('isForm', false)

// todo: replace placeholder var
const isPublicGrid = $ref(false)

const meta = inject(MetaInj)!

const column = inject(ColumnInj)!

const editEnabled = inject(EditModeInj, ref(false))

const storedFiles = ref<{ title: string; file: File }[]>([])

const attachments = ref<File[]>([])

const dropZoneRef = ref<HTMLDivElement>()

const { api, isLoading } = useApi()

const { project } = useProject()

const { files, open, reset } = useFileDialog()

const { isOverDropZone } = useDropZone(dropZoneRef, onDrop)

watch(
  () => modelValue,
  (nextModel) => {
    if (nextModel) {
      attachments.value = ((typeof nextModel === 'string' ? JSON.parse(nextModel) : nextModel) || []).filter(Boolean)
    }
  },
  { immediate: true },
)

function onDrop(droppedFiles: File[] | null) {
  if (droppedFiles) {
    // set files
    onFileSelection(droppedFiles)
  }
}

const selectImage = (file: any, i: unknown) => {
  // todo: implement
}

async function onFileSelection(selectedFiles: FileList | File[]) {
  if (!selectedFiles.length || isPublicGrid) return

  if (isPublicForm) {
    storedFiles.value.push(
      ...Array.from(selectedFiles).map((file) => {
        const res = { file, title: file.name }
        if (isImage(file.name, (file as any).mimetype)) {
          const reader = new FileReader()
          reader.readAsDataURL(file)
        }
        return res
      }),
    )

    emits(
      'update:modelValue',
      storedFiles.value.map((f) => f.file),
    )
  }

  const newAttachments = []

  for (const file of selectedFiles) {
    try {
      const data = await api.storage.upload(
        {
          path: [NOCO, project.value.title, meta.value.title, column.title].join('/'),
        },
        {
          files: file,
          json: '{}',
        },
      )

      newAttachments.push(...data)
    } catch (e: any) {
      notification.error({
        message: e.message || 'Some internal error occurred',
      })
    }
  }

  emits('update:modelValue', JSON.stringify([...attachments.value, ...newAttachments]))
}

watch(files, (nextFiles) => nextFiles && onFileSelection(nextFiles))

const items = computed(() => (isPublicForm ? storedFiles.value : attachments.value) || [])

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
</script>

<template>
  <div ref="dropZoneRef" class="flex-1 color-transition flex items-center justify-between gap-1">
    <template v-if="isOverDropZone">
      <div
        class="w-full h-full flex items-center justify-center p-1 rounded gap-1 bg-gradient-to-t from-primary/10 via-primary/25 to-primary/10 !text-primary"
      >
        <MaterialSymbolsFileCopyOutline class="text-pink-500" /> Drop here
      </div>
    </template>
    <template v-else>
      <div
        :class="{ 'mx-auto px-4': !items.length }"
        class="group flex gap-1 items-center active:ring rounded border-1 p-1 hover:bg-primary/10"
        @click.stop="open"
      >
        <MdiReload v-if="isLoading" :class="{ 'animate-infinite animate-spin': isLoading }" />

        <a-tooltip v-else placement="bottom">
          <template #title> Click or drop a file into cell </template>

          <div class="flex items-center gap-2">
            <MaterialSymbolsAttachFile class="transform group-hover:(text-pink-500 scale-120)" />

            <div v-if="!items.length" class="group-hover:text-primary">Add file(s)</div>
          </div>
        </a-tooltip>
      </div>

      <div class="h-full w-full flex flex-wrap flex-col overflow-x-scroll overflow-y-hidden gap-2 scrollbar-thin-primary py-1">
        <div
          v-for="(item, i) of items"
          :key="item.url || item.title"
          class="flex-auto flex items-center justify-center w-[45px] border-1"
        >
          <a-tooltip placement="bottom">
            <template #title>
              <div class="text-center w-full">{{ item.title }}</div>
            </template>

            <img
              v-if="isImage(item.title, item.mimetype)"
              :alt="item.title || `#${i}`"
              :src="item.url || item.data"
              @click="selectImage(item.url || item.data, i)"
            />

            <component :is="FileIcon(item.icon)" v-else-if="item.icon" @click="openLink(item.url || item.data)" />

            <IcOutlineInsertDriveFile v-else @click.stop="openLink(item.url || item.data)" />
          </a-tooltip>
        </div>
      </div>

      <div v-if="items.length" class="group flex gap-1 items-center active:ring rounded border-1 p-1 hover:bg-primary/10">
        <MdiReload v-if="isLoading" :class="{ 'animate-infinite animate-spin': isLoading }" />

        <a-tooltip v-else placement="bottom">
          <template #title> View attachments </template>

          <MaterialArrowExpandIcon class="transform group-hover:(text-pink-500 scale-120)" @click.stop />
        </a-tooltip>
      </div>
    </template>
  </div>
</template>
