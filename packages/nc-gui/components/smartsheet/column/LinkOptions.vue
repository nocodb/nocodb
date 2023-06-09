<script setup lang="ts">
import { useGlobal, useVModel } from '#imports'

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

// set default valueO
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
        <a-input v-model:value="vModel.meta.singular" class="!w-full nc-link-singular" />
      </a-form-item>
    </a-col>

    <a-col :span="12">
      <a-form-item v-bind="validateInfos['meta.plural']" label="Plural Label">
        <a-input v-model:value="vModel.meta.plural" class="!w-full nc-link-plural" />
      </a-form-item>
    </a-col>
  </a-row>
</template>
