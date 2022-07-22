<script setup lang="ts">
import { Form } from 'ant-design-vue'
import { useToast } from 'vue-toastification'
import { fieldRequiredValidator } from '~/utils/validation'

interface Props {
  modelValue: boolean
}

const { modelValue } = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

const toast = useToast()
const loading = ref(false)
const syncSource = ref({
  type: 'Airtable',
  details: {
    syncInterval: '15mins',
    syncDirection: 'Airtable to NocoDB',
    syncRetryCount: 1,
    apiKey: '',
    shareId: '',
    options: {
      syncViews: true,
      syncData: true,
      syncRollup: false,
      syncLookup: true,
      syncFormula: false,
      syncAttachment: true,
    },
  },
})

const useForm = Form.useForm

const validators = computed(() => {
  return {
    apiKey: [fieldRequiredValidator],
    sharedBaseIdOrUrl: [fieldRequiredValidator],
  }
})

const { resetFields, validate, validateInfos } = useForm(syncSource, validators)

const dialogShow = computed({
  get() {
    return modelValue
  },
  set(v) {
    emit('update:modelValue', v)
  },
})
</script>

<template>
  <a-modal v-model:visible="dialogShow" width="max(90vw, 600px)" @keydown.esc="dialogShow = false">
    <div class="pl-10 pr-10 pt-5">
      <h1 class="prose-2xl font-bold self-center">{{ $t('title.importFromAirtable') }}</h1>
      <a-divider />
      <div class="mb-4">
        <span class="prose-xl font-bold mr-3">Credentials</span>
        <a
          href="https://docs.nocodb.com/setup-and-usages/import-airtable-to-sql-database-within-a-minute-for-free/#get-airtable-credentials"
          class="prose-sm underline text-grey"
          target="_blank"
          >Where to find this?
        </a>
      </div>
      <a-form ref="formValidator" layout="vertical" :model="form">
        <a-form-item ref="form" :model="syncSource" name="quick-import-airtable-form" layout="horizontal" class="ma-0">
          <a-form-item v-bind="validateInfos.apiKey">
            <a-input-password v-model:value="syncSource.details.apiKey" placeholder="Api Key" size="large" />
          </a-form-item>
          <a-form-item v-bind="validateInfos.sharedBaseIdOrUrl">
            <a-input v-model:value="syncSource.details.shareId" placeholder="Shared Base ID / URL" size="large" />
          </a-form-item>
        </a-form-item>
        <span class="prose-xl font-bold self-center my-4">More Options</span>
        <a-divider />
        <div class="mt-0 my-2">
          <a-checkbox v-model:checked="syncSource.details.options.syncData">Import Data</a-checkbox>
        </div>
        <div class="my-2">
          <a-checkbox v-model:checked="syncSource.details.options.syncViews">Import Secondary Views</a-checkbox>
        </div>
        <div class="my-2">
          <a-checkbox v-model:checked="syncSource.details.options.syncRollup">Import Rollup Columns</a-checkbox>
        </div>
        <div class="my-2">
          <a-checkbox v-model:checked="syncSource.details.options.syncLookup">Import Lookup Columns</a-checkbox>
        </div>
        <div class="my-2">
          <a-checkbox v-model:checked="syncSource.details.options.syncAttachment">Import Attachment Columns</a-checkbox>
        </div>
        <a-tooltip placement="top">
          <template #title>
            <span>Coming Soon!</span>
          </template>
          <a-checkbox disabled v-model:checked="syncSource.details.options.syncFormula">Import Formula Columns</a-checkbox>
        </a-tooltip>
      </a-form>
      <a-divider />
      <div>
        <a href="https://github.com/nocodb/nocodb/issues/2052" target="_blank">Questions / Help - Reach out here</a>
        <br />
        <div>
          This feature is currently in beta and more information can be found
          <a class="prose-sm" href="https://github.com/nocodb/nocodb/discussions/2122" target="_blank">here</a>.
        </div>
      </div>
    </div>
  </a-modal>
</template>

<style scoped lang="scss"></style>
