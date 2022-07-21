<script setup lang="ts">
import type { UploadChangeParam } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

interface Props {
  modelValue: boolean
  importType: 'csv' | 'json' | 'excel'
}

const { modelValue, importType } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])
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
  <v-dialog
    v-model="dialogShow"
    persistent
    max-width="550"
    @keydown.esc="dialogShow = false"
    @keydown.enter="$emit('create', table)"
  >
    <v-card class="">
      <a-upload-dragger
        v-model:fileList="fileList"
        name="file"
        :multiple="true"
        action="https://www.mocky.io/v2/5cc8019d300000980a055e76"
        @change="handleChange"
        @drop="handleDrop"
      >
        <p class="ant-upload-drag-icon">
          <inbox-outlined></inbox-outlined>
        </p>
        <p class="ant-upload-text">Click or drag file to this area to upload</p>
        <p class="ant-upload-hint">
          {{ uploadHint }}
        </p>
      </a-upload-dragger>
    </v-card>
  </v-dialog>
</template>

<style scoped lang="scss"></style>