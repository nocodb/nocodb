<script lang="ts" setup>
import { useColumnCreateStoreOrThrow } from '#imports'
import { UITypes } from 'nocodb-sdk'

const { onAlter, sqlUi, formState } = useColumnCreateStoreOrThrow()

const props = defineProps<{
  value: string
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)


const valueType = computed(() => {
  switch (formState.value?.uidt) {
    case UITypes.Number:
    case UITypes.Decimal:
    case UITypes.Currency:
    case UITypes.Percent:
    case UITypes.Rating:
      return 'number'
    case UITypes.SingleLineText:
    case UITypes.LongText:
    case UITypes.SingleSelect:
    case UITypes.MultiSelect:
    case  UITypes.Email:
      return 'string'
    case  UITypes.Date:
    case  UITypes.DateTime:
    case  UITypes.Time:
      return 'date'
    case UITypes.Checkbox:
      return 'boolean'
  }
})

const defaultValue = computed({
  get() {
    switch (valueType.value) {
      case 'string':
        return vModel.value?.replace(/^'|'$/g, "").replace(/''/g,"'") || ''
      case 'number':
        return Number(vModel.value) || ''
      case 'boolean':
        return vModel.value === 'true'
    }
    return vModel.value ?? ''
  },
  set(value) {
    switch (valueType.value) {
      case 'string':
        vModel.value = `'${value?.toString()?.replace(/(?=')/g, "'")}'`
        break
      case 'number':
        vModel.value = `${value}`
        break
      case 'boolean':
        vModel.value = value ? 'true' : 'false'
        break
      default:
        vModel.value = `${value}`
        break
    }
    onAlter(2, true)
  },
})


const sampleValue = computed(() => {
  switch (valueType.value) {
    case 'string':
      return 'eg : sample text'
    case 'number':
      return 'eg : 123'
    case 'boolean':
      return ''
    default:
      return sqlUi.value.getDefaultValueForDatatype(formState.value.dt)
  }
})


</script>

<template>
  <div>
    <a-form-item :label="$t('placeholder.defaultValue')">
      <a-textarea v-model:value="defaultValue" v-if="valueType === 'string'" auto-size @input="onAlter(2, true)" />
      <a-input v-model:value="defaultValue" v-else-if="valueType === 'number'" type="number" auto-size
               @input="onAlter(2, true)" />
      <a-checkbox v-model:checked="defaultValue" v-else-if="valueType === 'boolean'" auto-size @input="onAlter(2, true)" />
      <a-textarea v-model:value="defaultValue" v-else auto-size @input="onAlter(2, true)" />
      <span class="text-gray-400 text-xs">{{ sampleValue }}</span>

    </a-form-item>
  </div>
</template>

<style scoped></style>
