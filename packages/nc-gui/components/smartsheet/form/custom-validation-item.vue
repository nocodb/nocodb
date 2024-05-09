<script setup lang="ts">
import type { Validation } from 'nocodb-sdk'
import type { ColumnType } from 'nocodb-sdk'
import { StringValidationType, ValidationTypeLabel } from 'nocodb-sdk'

const inputType = {
  [StringValidationType.MinLength]: 'number',
  [StringValidationType.MaxLength]: 'number',
  [StringValidationType.StartsWith]: 'text',
  [StringValidationType.EndsWith]: 'text',
  [StringValidationType.Includes]: 'text',
  [StringValidationType.NotIncludes]: 'text',
  [StringValidationType.Regex]: 'text',
  [StringValidationType.Email]: 'email',
}

const props = defineProps<{
  validator: Validation
  options: { value: string; label: string }[]
}>()

const emits = defineEmits(['update:validator', 'remove'])

const validator = useVModel(props, 'validator', emits)

const { options } = toRefs(props)

const validatorValueType = computed(() => {
  return inputType[validator.value.type] ?? 'text'
})

const validatorValue = computed({
  get: () => {
    return validator.value.value !== null ? `${validator.value.value ?? ''}` : validator.value.value
  },
  set: (value) => {
    if (validatorValueType.value === 'text') {
      validator.value.value = value ?? ''
    }
    if (validatorValueType.value === 'number') {
      validator.value.value = parseInt(value ?? '') || 0
    }

    emits('update:validator', validator.value)
  },
})

const handleChangeValidator = (value) => {
  if (validator.value?.value !== null) {
    if (validatorValueType.value === 'text' && typeof validator.value.value !== 'string') {
      validator.value.value = `${validator.value.value ?? ''}`
    }
    if (validatorValueType.value === 'number' && typeof validator.value.value !== 'number') {
      validator.value.value = parseInt(validator.value.value ?? '') || 0
    }
  }
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === '-') {
    e.preventDefault()
  }
}
</script>

<template>
  <div class="tr">
    <div class="td">
      <NcSelect
        v-model:value="validator.type"
        class="w-full !text-gray-600"
        :bordered="false"
        placeholder="Select and option"
        @change="handleChangeValidator"
      >
        <a-select-option v-for="option in options" :key="option.value" :value="option.value" class="!text-gray-600">
          <div class="flex items-center justify-between gap-2">
            <div class="truncate flex-1">
              <NcTooltip :title="option.label" placement="top" show-on-truncate-only>
                <template #title>{{ option.label }}</template>
                {{ option.label }}
              </NcTooltip>
            </div>
            <component
              :is="iconMap.check"
              v-if="validator.type === option.value"
              id="nc-selected-item-icon"
              class="text-primary w-4 h-4"
            />
          </div>
        </a-select-option>
      </NcSelect>
    </div>
    <div class="td flex items-center">
      <input
        :type="validatorValueType"
        v-model="validatorValue"
        placeholder="Type value..."
        :min="0"
        :disabled="!validator.type"
        @keydown="handleKeyDown"
        class="!w-full h-full !border-none text-sm !px-3 !py-1 !outline-none !focus:(outline-none border-none shadow-none) disabled:(bg-gray-50 cursor-not-allowed)"
      />
    </div>
    <div class="td flex items-center">
      <input
        type="text"
        v-model="validator.message"
        placeholder="Type error message..."
        class="!w-full h-full !border-none text-sm !px-3 !py-1 !outline-none !focus:(outline-none border-none shadow-none) disabled:(bg-gray-50 cursor-not-allowed)"
      />
    </div>
    <div class="td nc-custom-validation-delete-item">
      <NcButton class="border-1 flex items-center justify-between" type="link" size="small" @click="emits('remove')">
        <GeneralIcon icon="delete" class="flex-none h-4 w-4 text-gray-500 hover:text-gray-800" />
      </NcButton>
    </div>
  </div>
</template>

<style lang="scss"></style>
