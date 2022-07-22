<script setup lang="ts">
import { useToast } from 'vue-toastification'
import { Form } from 'ant-design-vue'
import type { UploadChangeParam } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import MdiFileIcon from '~icons/mdi/file-plus-outline'
import MdiFileUploadOutlineIcon from '~icons/mdi/file-upload-outline'
import MdiLinkVariantIcon from '~icons/mdi/link-variant'
import MdiCodeJSONIcon from '~icons/mdi/code-json'
import { fieldRequiredValidator, importUrlValidator } from '~/utils/validation'
const { t } = useI18n()

interface Props {
  modelValue: boolean
  importType: 'csv' | 'json' | 'excel'
}

const { modelValue, importType } = defineProps<Props>()

const toast = useToast()
const emit = defineEmits(['update:modelValue'])
const activeKey = ref('upload')
const jsonEditorRef = ref()
const loading = ref(false)
const useForm = Form.useForm

const importState = ref({
  fileList: [],
  url: '',
  json: {},
})

const validators = computed(() => {
  return {
    url: [fieldRequiredValidator, importUrlValidator],
  }
})

const { resetFields, validate, validateInfos } = useForm(importState, validators)

const handleDrop = (e: DragEvent) => {
  console.log(e)
}

const rejectDrop = (fileList: any[]) => {
  fileList.map((file) => {
    toast.error(`Failed to upload file ${file.name}`)
  })
}

const importMeta = computed(() => {
  if (importType === 'excel') {
    return {
      uploadHint: t('msg.info.excelSupport'),
      urlInputLabel: t('msg.info.excelURL'),
      loadUrlDirective: ['c:quick-import:excel:load-url'],
      acceptTypes: '.xls, .xlsx, .xlsm, .ods, .ots',
    }
  } else if (importType === 'csv') {
    return {
      uploadHint: '',
      urlInputLabel: t('msg.info.csvURL'),
      loadUrlDirective: ['c:quick-import:csv:load-url'],
      acceptTypes: '.csv',
    }
  } else if (importType === 'json') {
    return {
      uploadHint: '',
      acceptTypes: '.json',
    }
  }
  return {}
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
    toast.success(`Uploaded file ${info.file.name} successfully`)
  } else if (status === 'error') {
    toast.error(`Failed to upload file ${info.file.name}`)
  }
}

const formatJson = () => {
  jsonEditorRef.value.format()
}

const handleSubmit = () => {
  if (activeKey.value === 'upload') {
    // TODO
  } else if (activeKey.value === 'url') {
    // TODO
    try {
      validate()
    } catch (e) {
      // TODO
    }
  } else if (activeKey.value === 'json') {
    // TODO
  }
}
</script>

<template>
  <a-modal v-model:visible="dialogShow" width="max(90vw, 600px)" @keydown.esc="dialogShow = false">
    <template #footer>
      <a-button key="back" @click="dialogShow = false">Cancel</a-button>
      <a-button v-if="activeKey === 'json'" key="format" :loading="loading" @click="formatJson">Format JSON</a-button>
      <a-button key="submit" type="primary" :loading="loading" @click="handleSubmit">Import</a-button>
    </template>
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
            v-model:fileList="importState.fileList"
            name="file"
            :multiple="true"
            :accept="importMeta.acceptTypes"
            @change="handleChange"
            @drop="handleDrop"
            @reject="rejectDrop"
            list-type="picture"
          >
            <MdiFileIcon size="large" />
            <p class="ant-upload-text">Click or drag file to this area to upload</p>
            <p class="ant-upload-hint">
              {{ importMeta.uploadHint }}
            </p>
          </a-upload-dragger>
        </div>
      </a-tab-pane>
      <a-tab-pane v-if="importType === 'json'" key="json" :closable="false">
        <template #tab>
          <span class="flex items-center gap-2">
            <MdiCodeJSONIcon />
            Json Editor
          </span>
        </template>
        <div class="pl-10 pr-10 pb-10 pt-5">
          <MonacoEditor v-model="importState.json" class="h-[400px]" ref="jsonEditorRef" />
        </div>
      </a-tab-pane>
      <a-tab-pane v-else key="url" :closable="false">
        <template #tab>
          <span class="flex items-center gap-2">
            <MdiLinkVariantIcon />
            Url
          </span>
        </template>
        <div class="pl-10 pr-10 pb-10 pt-5">
          <a-form ref="formValidator" layout="vertical" :model="form">
            <a-form-item ref="form" :model="importState" name="quick-import-url-form" layout="horizontal" class="mb-0">
              <a-form-item :label="importMeta.urlInputLabel" v-bind="validateInfos.url">
                <a-input v-model:value="importState.url" size="large" />
              </a-form-item>
            </a-form-item>
          </a-form>
        </div>
      </a-tab-pane>
    </a-tabs>
  </a-modal>
</template>

<style scoped lang="scss">
:deep(.ant-upload-list) {
  overflow: auto;
  height: 300px;
}
</style>