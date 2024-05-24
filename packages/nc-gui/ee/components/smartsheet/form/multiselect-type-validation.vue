<script setup lang="ts">
import { SelectValidationType, type Validation } from 'nocodb-sdk'

const { activeField, updateColMeta } = useFormViewStoreOrThrow()

const isLimitRangeEnabled = computed(() => {
  return !!(
    activeField.value &&
    ((activeField.value.meta.validators || []) as Validation[]).find((val) => {
      return [SelectValidationType.MinSelected, SelectValidationType.MaxSelected].includes(val.type)
    })
  )
})

const getMinValidator = computed(() => {
  return ((activeField.value?.meta.validators || []) as Validation[]).find((val) => {
    return val.type === SelectValidationType.MinSelected
  })
})
const getMaxValidator = computed(() => {
  return ((activeField.value?.meta.validators || []) as Validation[]).find((val) => {
    return val.type === SelectValidationType.MaxSelected
  })
})

const addPlaceholderValidators = (value, type: 'minMax') => {
  if (!activeField.value) return

  switch (type) {
    case 'minMax': {
      if (value) {
        activeField.value.meta.validators = [
          ...(activeField.value.meta.validators || []),
          {
            type: SelectValidationType.MinSelected,
            value: null,
            message: '',
          },
          {
            type: SelectValidationType.MaxSelected,
            value: null,
            message: '',
          },
        ]
      } else {
        activeField.value.meta.validators = ((activeField.value.meta.validators || []) as Validation[]).filter((val) => {
          return ![SelectValidationType.MinSelected, SelectValidationType.MaxSelected].includes(val.type)
        })
        updateColMeta(activeField.value)
      }
      break
    }
  }
}
</script>

<template>
  <div v-if="activeField" class="w-full flex items-start justify-between gap-3">
    <div class="flex-1 max-w-[calc(100%_-_40px)]">
      <div
        class="font-medium text-gray-800 cursor-pointer select-none"
        @click="addPlaceholderValidators(!isLimitRangeEnabled, 'minMax')"
      >
        Limit selection
      </div>
      <div class="text-gray-500 mt-1">
        {{
          isMultiSelect(activeField)
            ? 'Limit the number of options that users can select.'
            : 'Limit the number of users that can be selected.'
        }}
      </div>

      <div v-if="isLimitRangeEnabled" class="nc-limit-to-range-wrapper mt-3 flex flex-col gap-3">
        <div>
          <LazySmartsheetFormValidationInput
            v-if="getMinValidator"
            :column="activeField"
            :validator="getMinValidator"
            :data-testid="`nc-limit-to-range-min-${activeField?.uidt}`"
            @update-validation-value="updateColMeta(activeField)"
          >
            <template #prefix> Minimum</template>
          </LazySmartsheetFormValidationInput>
          <LazySmartsheetFormValidationInputError :type="SelectValidationType.MinSelected" />
        </div>
        <div>
          <LazySmartsheetFormValidationInput
            v-if="getMaxValidator"
            :column="activeField"
            :validator="getMaxValidator"
            :data-testid="`nc-limit-to-range-max-${activeField?.uidt}`"
            @update-validation-value="updateColMeta(activeField)"
          >
            <template #prefix> Maximum</template>
          </LazySmartsheetFormValidationInput>
          <LazySmartsheetFormValidationInputError :type="SelectValidationType.MaxSelected" />
        </div>
      </div>
    </div>

    <a-switch
      :checked="isLimitRangeEnabled"
      size="small"
      class="flex-none nc-form-switch-focus"
      :data-testid="`nc-limit-to-range-${activeField?.uidt}`"
      @change="addPlaceholderValidators($event, 'minMax')"
    />
  </div>
</template>
