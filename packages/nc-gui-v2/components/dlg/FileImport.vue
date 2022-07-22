<script setup lang="ts">
import { useToast } from 'vue-toastification'
import { Form } from 'ant-design-vue'
import type { UploadChangeParam } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import MdiFileIcon from '~icons/mdi/file-plus-outline'
import MdiFileUploadOutlineIcon from '~icons/mdi/file-upload-outline'
import MdiLinkVariantIcon from '~icons/mdi/link-variant'
import MdiCodeJSONIcon from '~icons/mdi/code-json'
import { fieldRequiredValidator } from '~/utils/validation'
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
const urlValidator = ref()
const useForm = Form.useForm
const formState = reactive({
  url: '',
})
const validators = computed(() => {
  return {
    url: [fieldRequiredValidator],
  }
})

const { resetFields, validate, validateInfos } = useForm(formState, validators)

const handleDrop = (e: DragEvent) => {
  console.log(e)
}

const importMeta = computed(() => {
  if (importType === 'excel') {
    return {
      uploadHint: t('msg.info.excelSupport'),
      urlInputLabel: t('msg.info.excelURL'),
      loadUrlDirective: ['c:quick-import:excel:load-url'],
    }
  } else if (importType === 'csv') {
    return {
      uploadHint: '',
      urlInputLabel: t('msg.info.csvURL'),
      loadUrlDirective: ['c:quick-import:csv:load-url'],
    }
  } else if (importType === 'json') {
    return {
      uploadHint: '',
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
    toast.success(`${info.file.name} file uploaded successfully.`)
  } else if (status === 'error') {
    toast.error(`${info.file.name} file upload failed.`)
  }
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
  <a-modal
    v-model:visible="dialogShow"
    width="max(90vw, 600px)"
    @keydown.esc="dialogShow = false"
    @ok="handleSubmit"
    okText="Import"
  >
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
              {{ importMeta.uploadHint }}
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
        <div class="pl-10 pr-10 pb-10 pt-5">
          <a-form ref="formValidator" layout="vertical" :model="form">
            <a-form-item ref="form" :model="formState" name="quick-import-url-form" layout="horizontal" class="mb-0">
              <a-form-item :label="importMeta.urlInputLabel" v-bind="validateInfos.url">
                <a-input v-model:value="formState.url" size="large" />
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
