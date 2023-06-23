<script setup lang="ts">
import { useColumnCreateStoreOrThrow, useVModel } from '#imports'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const { validateInfos, setAdditionalValidations } = useColumnCreateStoreOrThrow()

setAdditionalValidations({
  'meta.singular': [
    {
      validator: (_, value: string) => {
        return new Promise((resolve, reject) => {
          if (value?.length > 59) {
            return reject(new Error('The length exceeds the max 59 characters'))
          }
          resolve(true)
        })
      },
    },
  ],
  'meta.plural': [
    {
      validator: (_, value: string) => {
        return new Promise((resolve, reject) => {
          if (value?.length > 59) {
            return reject(new Error('The length exceeds the max 59 characters'))
          }
          resolve(true)
        })
      },
    },
  ],
})

// set default value
vModel.value.meta = {
  singular: '',
  plural: '',
  ...vModel.value.meta,
}
</script>

<template>
  <a-row class="my-2" gutter="8">
    <a-col :span="12">
      <a-form-item v-bind="validateInfos['meta.singular']" label="Singular Label">
        <a-input v-model:value="vModel.meta.singular" placeholder="Link" class="!w-full nc-link-singular" />
      </a-form-item>
    </a-col>

    <a-col :span="12">
      <a-form-item v-bind="validateInfos['meta.plural']" label="Plural Label">
        <a-input v-model:value="vModel.meta.plural" placeholder="Links" class="!w-full nc-link-plural" />
      </a-form-item>
    </a-col>
  </a-row>
</template>
