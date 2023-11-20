<script setup lang="ts">
import { useColumnCreateStoreOrThrow, useVModel } from '#imports'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const { t } = useI18n()

const vModel = useVModel(props, 'value', emit)

const { validateInfos, setAdditionalValidations } = useColumnCreateStoreOrThrow()

setAdditionalValidations({
  'meta.singular': [
    {
      validator: (_, value: string) => {
        return new Promise((resolve, reject) => {
          if (value?.length > 59) {
            return reject(t('msg.length59Required'))
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
            return reject(t('msg.length59Required'))
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
      <a-form-item v-bind="validateInfos['meta.singular']" :label="$t('labels.singularLabel')">
        <a-input v-model:value="vModel.meta.singular" :placeholder="$t('general.link')" class="!w-full nc-link-singular" />
      </a-form-item>
    </a-col>

    <a-col :span="12">
      <a-form-item v-bind="validateInfos['meta.plural']" :label="$t('labels.pluralLabel')">
        <a-input v-model:value="vModel.meta.plural" :placeholder="$t('general.links')" class="!w-full nc-link-plural" />
      </a-form-item>
    </a-col>
  </a-row>
</template>
