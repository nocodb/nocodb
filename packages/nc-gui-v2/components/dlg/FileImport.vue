<script setup lang="ts">
import type { UploadChangeParam } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import MdiFileIcon from '~icons/mdi/file-plus-outline'
const { t } = useI18n()

interface Props {
  modelValue: boolean
  importType: 'csv' | 'json' | 'excel'
}

const { modelValue, importType } = defineProps<Props>()

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
    console.log(`${info.file.name} file uploaded successfully.`)
  } else if (status === 'error') {
    console.log(`${info.file.name} file upload failed.`)
  }
}
</script>

<template>
  <v-dialog v-model="dialogShow" persistent @keydown.esc="dialogShow = false">
    <v-card style="height: 400px; width: 700px">
      <a-tabs v-model:activeKey="activeKey" hide-add type="editable-card" :tab-position="top">
        <a-tab-pane key="upload" :closable="false">
          <template #tab>
            <span>
              <MdiTableIcon class="text-primary mdi-icons" />
              Upload
            </span>
          </template>
          <a-upload-dragger v-model:fileList="fileList" name="file" :multiple="true" @change="handleChange" @drop="handleDrop">
            <MdiFileIcon />
            <p class="ant-upload-text">Click or drag file to this area to upload</p>
            <p class="ant-upload-hint">
              {{ uploadHint }}
            </p>
          </a-upload-dragger>
        </a-tab-pane>
        <a-tab-pane v-if="importType === 'json'" key="json" :closable="false">
          <template #tab>
            <span>
              <MdiTableIcon class="text-primary mdi-icons" />
              Json String
            </span>
          </template>
          <!-- TODO -->
        </a-tab-pane>
        <a-tab-pane v-else key="url" :closable="false">
          <template #tab>
            <span>
              <MdiTableIcon class="text-primary mdi-icons" />
              Url
            </span>
          </template>
          <!-- TODO -->
        </a-tab-pane>
      </a-tabs>
    </v-card>
  </v-dialog>
</template>

<style scoped lang="scss"></style>
