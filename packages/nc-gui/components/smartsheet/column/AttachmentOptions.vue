<script setup lang="ts">
import type { TreeProps } from 'ant-design-vue'
import type { CheckboxChangeEvent } from 'ant-design-vue/es/checkbox/interface'
import { fileMimeTypeList, fileMimeTypes } from './utils'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const validators = {}

const { setAdditionalValidations, validateInfos } = useColumnCreateStoreOrThrow()

const { appInfo } = useGlobal()

const searchValue = ref<string>('')

setAdditionalValidations({
  ...validators,
})

// set default value
vModel.value.meta = {
  ...(appInfo.value.ee && {
    // Maximum Number of Attachments per cell
    maxNumberOfAttachments: Math.max(1, +appInfo.value.ncMaxAttachmentsAllowed || 50) || 50,
    // Maximum File Size per file
    maxAttachmentSize: Math.max(1, +appInfo.value.ncAttachmentFieldSize || 20) || 20,
    // allow all mime types by default
    supportedAttachmentMimeTypes: ['*'],
  }),
  ...(vModel.value.meta || {}),
}

const expandedKeys = ref<(string | number)[]>([])

const autoExpandParent = ref<boolean>(true)

const allowAllMimeTypeCheckbox = ref(true)

const getParentKey = (key: string | number, tree: TreeProps['treeData']): string | null => {
  if (!tree) return null
  let parentKey
  for (let i = 0; i < tree.length; i++) {
    const node = tree[i]
    if (node.children) {
      if (node.children.some((item) => item.key === key)) {
        parentKey = node.key as string
      } else if (getParentKey(key, node.children)) {
        parentKey = getParentKey(key, node.children) as string
      }
    }
  }
  return parentKey as string
}

function allowAllMimeTypeCheckboxOnChange(evt: CheckboxChangeEvent) {
  if (evt.target.checked) {
    vModel.value.meta.supportedAttachmentMimeTypes = ['*']
  } else {
    vModel.value.meta.supportedAttachmentMimeTypes = ['application', 'audio', 'image', 'video', 'misc']
  }
}

watch(searchValue, (value) => {
  expandedKeys.value = fileMimeTypeList
    ?.map((item: Record<string, any>) => {
      if (item.title.includes(value)) {
        return getParentKey(item.key, fileMimeTypes)
      }
      return null
    })
    .filter((item: any, i: number, self: any[]) => item && self.indexOf(item) === i) as string[]
  searchValue.value = value
  autoExpandParent.value = true
})
</script>

<template>
  <a-row class="my-2" :gutter="8">
    <a-col :span="12">
      <a-form-item v-bind="validateInfos['meta.maxNumberOfAttachments']" label="Max Number of Attachments">
        <a-input-number v-model:value="vModel.meta.maxNumberOfAttachments" :min="1" class="!w-full nc-attachment-max-count" />
      </a-form-item>
    </a-col>

    <a-col :span="12">
      <a-form-item v-bind="validateInfos['meta.maxAttachmentSize']" label="Max Attachment Size (MB)">
        <a-input-number v-model:value="vModel.meta.maxAttachmentSize" :min="1" class="!w-full nc-attachment-max-size" />
      </a-form-item>
    </a-col>

    <a-col class="mt-4" :span="24">
      <a-form-item v-bind="validateInfos['meta.supportedAttachmentMimeTypes']" class="!p-[10px] border-2">
        <a-checkbox
          v-model:checked="allowAllMimeTypeCheckbox"
          class="nc-allow-all-mime-type-checkbox"
          name="virtual"
          @change="allowAllMimeTypeCheckboxOnChange"
        >
          Allow All Mime Types
        </a-checkbox>
        <div v-if="!allowAllMimeTypeCheckbox" class="mt-[5px]">
          <a-input-search v-model:value="searchValue" class="mt-[5px] mb-[15px]" placeholder="Search" />
          <a-tree
            v-model:expanded-keys="expandedKeys"
            v-model:checkedKeys="vModel.meta.supportedAttachmentMimeTypes"
            checkable
            :height="250"
            :tree-data="fileMimeTypes"
            :auto-expand-parent="autoExpandParent"
            class="!bg-gray-50 my-[10px]"
          >
            <template #title="{ title }">
              <span v-if="title.indexOf(searchValue) > -1">
                {{ title.substr(0, title.indexOf(searchValue)) }}
                <span class="text-primary font-bold">{{ searchValue }}</span>
                {{ title.substr(title.indexOf(searchValue) + searchValue.length) }}
              </span>
              <span v-else>{{ title }}</span>
            </template>
          </a-tree>
        </div>
      </a-form-item>
    </a-col>
  </a-row>
</template>
