<script setup lang="ts">
import { notification } from 'ant-design-vue'
import { computed, inject, ref, useApi, useDropZone, useFileDialog, useProject, watch } from '#imports'
import { ColumnInj, EditModeInj, MetaInj } from '~/context'
import { NOCO } from '~/lib'
import { isImage } from '~/utils'
import MaterialSymbolsAttachFile from '~icons/material-symbols/attach-file'
import MaterialArrowExpandIcon from '~icons/mdi/arrow-expand'
import MaterialSymbolsFileCopyOutline from '~icons/material-symbols/file-copy-outline'

interface Props {
  modelValue: string | Record<string, any>[] | null
}

const { modelValue } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const isPublicForm = inject<boolean>('isPublicForm', false)

const isForm = inject<boolean>('isForm', false)

const meta = inject(MetaInj)!

const column = inject(ColumnInj)!

const editEnabled = inject(EditModeInj, ref(false))

const attachments = ref([])

const uploading = ref(false)

const dropZoneRef = ref<HTMLDivElement>()

const { api } = useApi()

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
)

function onDrop(droppedFiles: File[] | null) {
  if (droppedFiles) {
    // set files
    console.log(droppedFiles)
  }
}

const selectImage = (file: any, i: unknown) => {
  // todo: implement
}

const openUrl = (url: string, target = '_blank') => {
  window.open(url, target)
}

const onFileSelection = async (e: unknown) => {
  if (!files.value) return

  // if (this.isPublicGrid) {
  //   return
  // }
  // if (!this.$refs.file.files || !this.$refs.file.files.length) {
  //   return
  // }

  // if (this.isPublicForm) {
  //   this.localFilesState.push(...Array.from(this.$refs.file.files).map((file) => {
  //     const res = { file, title: file.name }
  //     if (isImage(file.name, file.mimetype)) {
  //       const reader = new FileReader()
  //       reader.onload = (e) => {
  //         this.$set(res, 'data', e.target.result)
  //       }
  //       reader.readAsDataURL(file)
  //     }
  //     return res
  //   }))
  //
  //   this.$emit('input', this.localFilesState.map(f => f.file))
  //   return
  // }

  uploading.value = true

  const newAttachments = []

  for (const file of files.value) {
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

  uploading.value = false

  emit('update:modelValue', JSON.stringify([...attachments.value, ...newAttachments]))
}

watch(files, console.log)

const items = computed(() => (isPublicForm ? files.value : attachments.value) || [])
</script>

<template>
  <div class="flex items-center">
    <div ref="dropZoneRef" class="flex-1 group color-transition flex items-center p-1 hover:text-primary">
      <template v-if="isOverDropZone">
        <div
          class="w-full h-full flex items-center justify-center p-1 rounded gap-1 bg-gradient-to-t from-primary/10 via-primary/25 to-primary/10 !text-primary"
        >
          <MaterialSymbolsFileCopyOutline class="text-pink-500" /> Drop here
        </div>
      </template>
      <template v-else>
        <div class="flex overflow-hidden">
          <div v-for="(item, i) of items" :key="item.url || item.title" class="thumbnail align-center justify-center d-flex">
            <img
              v-if="isImage(item.title, item.mimetype)"
              alt="#"
              style="max-height: 30px; max-width: 30px"
              :src="item.url || item.data"
              @click="selectImage(item.url || item.data, i)"
            />
            <v-icon v-else-if="item.icon" :size="active ? 33 : 22" v-on="on" @click="openUrl(item.url || item.data, '_blank')">
              {{ item.icon }}
            </v-icon>
            <v-icon v-else :size="active ? 33 : 22" v-on="on" @click="openUrl(item.url || item.data, '_blank')">
              mdi-file
            </v-icon>
          </div>
        </div>

        <!--      todo: hide or toggle based on ancestor -->
        <div class="mx-auto flex gap-1 items-center active:ring rounded border-1 py-1 px-4" @click.stop="open">
          <v-icon v-if="uploading" small color="primary" class="nc-attachment-add-spinner"> mdi-loading mdi-spin</v-icon>

          <a-tooltip placement="bottom">
            <template #title> Click or drop a file into cell </template>
            <div class="flex items-center gap-2">
              <MaterialSymbolsAttachFile class="transform group-hover:(text-pink-500 scale-120)" />
              <div v-if="!items.length">Add file(s)</div>
            </div>
          </a-tooltip>
        </div>

        <MaterialArrowExpandIcon v-if="items.length" @click.stop />
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.thumbnail {
  height: 30px;
  width: 30px;
  margin: 2px;
  border-radius: 4px;

  img {
    max-height: 33px;
    max-width: 33px;
  }
}
</style>
