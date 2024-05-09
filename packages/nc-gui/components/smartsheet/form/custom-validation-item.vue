<script setup lang="ts">
import type { Validation } from 'nocodb-sdk'
import { StringValidationType } from 'nocodb-sdk'

const props = defineProps<{
  validator: Validation
  options: { value: string; label: string }[]
  validatorsMap: Record<Exclude<Validation['type'], null>, Validation>
}>()

const emits = defineEmits(['update:validator', 'remove'])

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

const validator = useVModel(props, 'validator', emits)

const { options, validatorsMap } = toRefs(props)

const validatorValueType = computed(() => {
  return inputType[validator.value.type] ?? 'text'
})

const validatorValue = computed({
  get: () => {
    if (validator.value.type === StringValidationType.Regex) {
      return `${validator.value.regex ?? ''}`
    } else {
      return `${validator.value.value ?? ''}`
    }
  },
  set: (value) => {
    if (validator.value.type === StringValidationType.Regex) {
      validator.value.regex = value ?? ''
    } else {
      if (validatorValueType.value === 'text') {
        validator.value.value = value ?? ''
      }
      if (validatorValueType.value === 'number') {
        validator.value.value = parseInt(value ?? '') || 0
      }
    }
    emits('update:validator', validator.value)
  },
})

const handleChangeValidator = () => {
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

watchEffect(() => {
  console.log(' validatorsMap[option.value]', validatorsMap.value)
})
</script>

<template>
  <div class="tr">
    <div class="td">
      <NcSelect
        v-model:value="validator.type"
        class="w-full !text-gray-600"
        :bordered="false"
        placeholder="Select and option"
        dropdown-class-name="nc-custom-validation-type-dropdown"
        @change="handleChangeValidator"
      >
        <a-select-option
          v-for="option in options"
          :key="option.value"
          :value="option.value"
          :disabled="
            validator.type !== option.value &&
            ![StringValidationType.Includes, StringValidationType.NotIncludes].includes(option.value) &&
            !!validatorsMap[option.value]
          "
          class=":not-disabled:!text-gray-600"
        >
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
        v-model="validatorValue"
        :type="validatorValueType"
        placeholder="Type value..."
        :min="0"
        :disabled="!validator.type"
        class="!w-full h-full !border-none text-sm !px-3 !py-1 !outline-none !focus:(outline-none border-none shadow-none) disabled:(bg-gray-50 cursor-not-allowed)"
        @keydown="handleKeyDown"
      />
    </div>
    <div class="td flex items-center">
      <input
        v-model="validator.message"
        type="text"
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

<style lang="scss" scoped>
:deep(.nc-select-dropdown .rc-virtual-list-holder) {
  @apply max-h-[300px];
}
:deep(.ant-select-selection-placeholder) {
  @apply text-gray-300;
}
</style>
