<script setup lang="ts">
import type { Validation } from 'nocodb-sdk'
import { InputType, StringValidationType } from 'nocodb-sdk'

const props = defineProps<{
  validator: Validation
  index: number
  options: { value: string; label: string }[]
  validatorsMap: Record<Exclude<Validation['type'], null>, Validation>
}>()

const emits = defineEmits(['update:validator', 'remove'])

const validator = useVModel(props, 'validator', emits)

const { index, options, validatorsMap } = toRefs(props)

const { activeField, updateColMeta, getActiveFieldValidationErrors } = useFormViewStoreOrThrow()

const validatorValueType = computed(() => {
  return InputType[validator.value.type] ?? 'text'
})

const validationErrors = computed(() => {
  if (!activeField.value || (activeField.value && !validator.value.type)) return []

  return getActiveFieldValidationErrors(validator.value.type, index.value)
})

const handleChangeValidator = () => {
  if (!activeField.value) return

  if (validator.value?.value !== null) {
    if (validatorValueType.value === 'text' && typeof validator.value.value !== 'string') {
      validator.value.value = `${validator.value.value ?? ''}`
    }
    if (validatorValueType.value === 'number' && typeof validator.value.value !== 'number') {
      validator.value.value = parseInt(validator.value.value ?? '') || 0
    }
    updateColMeta(activeField.value)
  }
}
</script>

<template>
  <div class="tr" :data-testid="`nc-custom-validation-item-${index}`">
    <div class="td">
      <NcSelect
        v-model:value="validator.type"
        class="nc-custom-validation-type-selector w-full !text-nc-content-gray-subtle2"
        :bordered="false"
        placeholder="Select and option"
        :data-testid="`nc-custom-validation-type-${validator.value}`"
        :dropdown-class-name="`nc-custom-validation-type-dropdown !min-w-[256px] nc-custom-validation-type-dropdown-${index}`"
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
          class=":not-disabled:!text-nc-content-gray-subtle2"
          :data-testid="`nc-custom-validation-type-option-${option.value}`"
        >
          <div class="w-full flex items-center justify-between gap-2">
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
    <div class="nc-custom-validation-input-wrapper td flex items-center relative">
      <LazySmartsheetFormValidationInput
        :class="{
          'pr-4': validationErrors.length,
        }"
        :column="activeField"
        :validator="validator"
        is-custom-validation-input
        @update-validation-value="updateColMeta(activeField)"
      >
      </LazySmartsheetFormValidationInput>
      <NcTooltip v-if="validationErrors.length" placement="bottom" class="absolute right-1 flex text-nc-content-red-medium">
        <template #title>
          <div class="flex flex-col">
            <span v-for="(error, i) in validationErrors" :key="i"> {{ error }} </span>
          </div></template
        >
        <GeneralIcon icon="alertTriangle" class="nc-custom-validation-item-error-icon flex-none" />
      </NcTooltip>
    </div>
    <div class="td flex items-center">
      <input
        v-model="validator.message"
        type="text"
        placeholder="Type error message..."
        class="nc-custom-validation-error-message-input !w-full h-full !border-none text-sm !px-3 !py-1 !outline-none !focus:(outline-none border-none shadow-none ring-transparent) disabled:(bg-nc-bg-gray-extralight cursor-not-allowed) !placeholder-nc-content-gray-muted"
        @update:model-value="updateColMeta(activeField)"
      />
    </div>
    <div class="td">
      <NcButton
        class="nc-custom-validation-delete-item border-1 flex items-center justify-between"
        type="link"
        size="small"
        @click="emits('remove')"
      >
        <GeneralIcon icon="delete" class="flex-none h-4 w-4 text-nc-content-gray-muted hover:text-nc-content-gray" />
      </NcButton>
    </div>
  </div>
</template>

<style lang="scss">
.nc-custom-validation-type-dropdown.nc-select-dropdown {
  .rc-virtual-list-holder {
    @apply !max-h-[300px];
  }

  .ant-select-item-option:not(.ant-select-item-option-disabled) {
    @apply !hover:text-nc-content-gray-extreme !text-nc-content-gray-subtle;
  }
}
.nc-custom-validation-type-selector.nc-select.ant-select {
  &:hover {
    @apply bg-nc-bg-gray-extralight;

    .ant-select-selection-placeholder {
      @apply text-nc-content-gray-subtle2;
    }
  }
  &.ant-select-single.ant-select-open .ant-select-selection-item {
    color: inherit !important;
  }
  .ant-select-selection-placeholder {
    @apply text-nc-content-gray-muted;
  }
}
</style>
