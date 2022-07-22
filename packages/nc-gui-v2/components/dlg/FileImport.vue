<script setup lang="ts">
import { useToast } from 'vue-toastification'
import type { UploadChangeParam } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import MdiFileIcon from '~icons/mdi/file-plus-outline'
import MdiFileUploadOutlineIcon from '~icons/mdi/file-upload-outline'
import MdiLinkVariantIcon from '~icons/mdi/link-variant'
import MdiCodeJSONIcon from '~icons/mdi/code-json'
const { t } = useI18n()

interface Props {
  modelValue: boolean
  importType: 'csv' | 'json' | 'excel'
}

const { modelValue, importType } = defineProps<Props>()

const toast = useToast()
const emit = defineEmits(['update:modelValue'])
const activeKey = ref('upload')
const fileList = ref([])
const handleDrop = (e: DragEvent) => {
  console.log(e)
}

const uploadHint = computed(() => {
  if (importType === 'excel') {
    return t('msg.info.excelSupport')
  }
})

const dialogShow = computed({
  get() {
    return modelValue
  },
  set(v) {
    emit('update:modelValue', v)
  },
})

const handleChange = (info: UploadChangeParam) => {
  const status = info.file.status
  if (status !== 'uploading') {
    console.log(info.file, info.fileList)
  }
  if (status === 'done') {
    toast.success(`${info.file.name} file uploaded successfully.`)
  } else if (status === 'error') {
    toast.error(`${info.file.name} file upload failed.`)
  }
}
</script>

<template>
  <v-dialog v-model="dialogShow" persistent @keydown.esc="dialogShow = false">
    <v-card class="w-300 max-h-300">
      <a-tabs v-model:activeKey="activeKey" hide-add type="editable-card" :tab-position="top">
        <a-tab-pane key="upload" :closable="false">
          <template #tab>
            <span class="flex items-center gap-2">
              <MdiFileUploadOutlineIcon />
              Upload
            </span>
          </template>
          <div class="pl-10 pr-10 pb-10 pt-5">
            <a-upload-dragger
              v-model:fileList="fileList"
              name="file"
              :multiple="true"
              @change="handleChange"
              @drop="handleDrop"
              list-type="picture"
            >
              <MdiFileIcon size="large" />
              <p class="ant-upload-text">Click or drag file to this area to upload</p>
              <p class="ant-upload-hint">
                {{ uploadHint }}
              </p>
            </a-upload-dragger>
          </div>
        </a-tab-pane>
        <a-tab-pane v-if="importType === 'json'" key="json" :closable="false">
          <template #tab>
            <span class="flex items-center gap-2">
              <MdiCodeJSONIcon />
              Json String
            </span>
          </template>
          <!-- TODO -->
        </a-tab-pane>
        <a-tab-pane v-else key="url" :closable="false">
          <template #tab>
            <span class="flex items-center gap-2">
              <MdiLinkVariantIcon />
              Url
            </span>
          </template>
          <!-- TODO -->
        </a-tab-pane>
      </a-tabs>
    </v-card>
  </v-dialog>
</template>

<style scoped lang="scss">
:deep(.ant-upload-list) {
  overflow: auto;
  height: 300px;
}
</style>
