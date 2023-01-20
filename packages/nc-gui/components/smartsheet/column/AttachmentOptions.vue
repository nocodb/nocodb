<script setup lang="ts">
import { fileMimeTypes } from './utils'
import { useGlobal, useVModel } from '#imports'

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

// set default value
vModel.value.meta = {
  ...(appInfo.value.ee && {
    // Maximum Number of Attachments per cell
    maxNumberOfAttachments: Math.max(1, +appInfo.value.ncMaxAttachmentsAllowed || 50) || 50,
    // Maximum File Size per file
    maxAttachmentSize: Math.max(1, +appInfo.value.ncMaxAttachmentsAllowed || 20) || 20,
    supportedAttachmentMimeTypes: ['application', 'audio', 'image', 'video', 'misc'],
  }),
  ...vModel.value.meta,
}

const filterOption = (val: string, option: Option) => {
  return option.title.includes(val)
}

const expandedKeys = ref<string[]>([])
</script>

<template>
  <a-row class="my-2" gutter="8">
    <a-col :span="12">
      <a-form-item v-bind="validateInfos['meta.maxNumberOfAttachments']" label="Max Number of Attachments">
        <a-input-number v-model:value="vModel.meta.maxNumberOfAttachments" :min="1" class="!w-full nc-extdb-host-port" />
      </a-form-item>
    </a-col>

    <a-col :span="12">
      <a-form-item v-bind="validateInfos['meta.maxAttachmentSize']" label="Max Attachment Size (MB)">
        <a-input-number v-model:value="vModel.meta.maxAttachmentSize" :min="1" class="!w-full nc-extdb-host-port" />
      </a-form-item>
    </a-col>

    <a-col class="mt-4" :span="24">
      <a-form-item v-bind="validateInfos['meta.supportedAttachmentMimeTypes']" label="Allowed Mime Types">
        <a-tree
          v-model:expandedKeys="expandedKeys"
          v-model:checkedKeys="vModel.meta.supportedAttachmentMimeTypes"
          checkable
          :height="250"
          :tree-data="fileMimeTypes"
          class="!bg-gray-50 !py-[10px] !my-[10px] border-2"
        >
          <template #title="{ title, key }">
            {{ title }}
          </template>
        </a-tree>
      </a-form-item>
    </a-col>
  </a-row>
</template>
