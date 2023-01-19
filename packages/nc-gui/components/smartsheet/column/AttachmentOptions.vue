<script setup lang="ts">
import { useGlobal, useVModel } from '#imports'
import { fileMimeTypes } from './utils'

interface Option {
  key: string
  title: string
}

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const validators = {}

const { setAdditionalValidations, validateInfos } = useColumnCreateStoreOrThrow()

const { appInfo } = useGlobal()

setAdditionalValidations({
  ...validators,
})

// TBC
const maxNumberOfAttachmentsLowerLimit = 1
const maxNumberOfAttachmentsUpperLimit = 10000
const maxNumberOfAttachmentsDefaultLimit = 10
const maxNumberOfAttachmentsLimit = appInfo.value.ee
  ? Math.min(
      maxNumberOfAttachmentsUpperLimit,
      Math.max(maxNumberOfAttachmentsLowerLimit, appInfo.value.ncMaxAttachmentsAllowed ?? maxNumberOfAttachmentsDefaultLimit),
    )
  : maxNumberOfAttachmentsDefaultLimit

// TBC
const maxAttachmentSizeDefaultLimit = 20
const maxAttachmentSizeLowerLimit = 1
const maxAttachmentSizeUpperLimit = 10000
const maxAttachmentSizeLimit = appInfo.value.ee
  ? Math.min(
      maxAttachmentSizeUpperLimit,
      Math.max(maxAttachmentSizeLowerLimit, appInfo.value.ncMaxAttachmentsAllowed ?? maxAttachmentSizeDefaultLimit),
    )
  : maxAttachmentSizeDefaultLimit

// set default value
vModel.value.meta = {
  // Maximum Number of Attachments per cell
  maxNumberOfAttachments: maxNumberOfAttachmentsDefaultLimit,
  // Maximum File Size per file
  maxAttachmentSize: maxAttachmentSizeDefaultLimit,
  unsupportedAttachmentMimeTypes: [],
  ...vModel.value.meta,
}

// the selected keys in the a-transfer
const selectedKeys = ref<string[]>([])

const filterOption = (val: string, option: Option) => {
  return option.title.includes(val)
}
</script>

<template>
  <a-row class="my-2" gutter="8">
    <a-col :span="12">
      <a-form-item v-bind="validateInfos['meta.maxNumberOfAttachments']" label="Max Number of Attachments">
        <a-input-number
          v-model:value="vModel.meta.maxNumberOfAttachments"
          :min="maxNumberOfAttachmentsLowerLimit"
          :max="maxNumberOfAttachmentsLimit"
          class="!w-full nc-extdb-host-port"
        />
      </a-form-item>
    </a-col>

    <a-col :span="12">
      <a-form-item v-bind="validateInfos['meta.maxAttachmentSize']" label="Max Attachment Size (MB)">
        <a-input-number
          v-model:value="vModel.meta.maxAttachmentSize"
          :min="maxAttachmentSizeLowerLimit"
          :max="maxAttachmentSizeLimit"
          class="!w-full nc-extdb-host-port"
        />
      </a-form-item>
    </a-col>

    <a-col :span="24">
      <a-form-item v-bind="validateInfos['meta.unsupportedAttachmentMimeTypes']" label="Mime Types">
        <a-transfer
          v-model:target-keys="vModel.meta.unsupportedAttachmentMimeTypes"
          v-model:selected-keys="selectedKeys"
          class="nc-attachment-transfer"
          show-search
          :list-style="{
            width: '220px',
            height: '300px',
          }"
          :filter-option="filterOption"
          :data-source="fileMimeTypes.map((o) => ({ key: o, title: o }))"
          :render="(item) => item.title"
          :titles="['allowed', 'not allowed']"
          :locale="{ itemUnit: 'type ', itemsUnit: 'types ' }"
        />
      </a-form-item>
    </a-col>
  </a-row>
</template>
