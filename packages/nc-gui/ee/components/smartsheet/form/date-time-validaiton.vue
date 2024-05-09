<script setup lang="ts">
import { DateValidationType, TimeValidationType, UITypes, type Validation, YearValidationType } from 'nocodb-sdk'

const { activeField, updateColMeta } = useFormViewStoreOrThrow()

const getValidationType = computed(() => {
  if (UITypes.Time === activeField.value?.uidt) {
    return {
      Min: TimeValidationType.MinTime,
      Max: TimeValidationType.MaxTime,
    }
  } else if (UITypes.Year === activeField.value?.uidt) {
    return {
      Min: YearValidationType.MinYear,
      Max: YearValidationType.MaxYear,
    }
  } else {
    return {
      Min: DateValidationType.MinDate,
      Max: DateValidationType.MaxDate,
    }
  }
})

const isLimitEnabled = computed(() => {
  return !!(
    activeField.value &&
    ((activeField.value.meta.validators || []) as Validation[]).find((val) => {
      return [getValidationType.value.Min, getValidationType.value.Max].includes(val.type)
    })
  )
})

const getMinValidator = computed(() => {
  return ((activeField.value?.meta.validators || []) as Validation[]).find((val) => {
    return val.type === getValidationType.value.Min
  })
})
const getMaxValidator = computed(() => {
  return ((activeField.value?.meta.validators || []) as Validation[]).find((val) => {
    return val.type === getValidationType.value.Max
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
            type: getValidationType.value.Min,
            value: null,
            message: '',
          },
          {
            type: getValidationType.value.Max,
            value: null,
            message: '',
          },
        ]
      } else {
        activeField.value.meta.validators = ((activeField.value.meta.validators || []) as Validation[]).filter((val) => {
          return ![getValidationType.value.Min, getValidationType.value.Max].includes(val.type)
        })
        updateColMeta(activeField.value)
      }
      break
    }
  }
}
</script>

<template v-if="activeField">
  <div class="w-full flex items-start justify-between gap-3">
    <div class="flex-1 max-w-[calc(100%_-_40px)]">
      <div
        class="font-medium text-gray-800 cursor-pointer select-none"
        @click="addPlaceholderValidators(!isLimitEnabled, 'minMax')"
      >
        Limit {{ activeField?.uidt?.toLowerCase().replace('datetime', 'date') || 'number' }} to a range
      </div>
      <div v-if="isLimitEnabled" class="mt-3 flex flex-col gap-3">
        <div>
          <LazySmartsheetFormValidationInput
            v-if="getMinValidator"
            :column="activeField"
            :validator="getMinValidator"
            @update-validation-value="updateColMeta(activeField)"
          >
            <template #prefix> Minimum</template>
            <template v-if="UITypes.Currency && activeField?.meta?.currency_code" #suffix>
              {{ activeField?.meta?.currency_code }}</template
            >
          </LazySmartsheetFormValidationInput>
          <LazySmartsheetFormValidationInputError :type="getValidationType.Min" />
        </div>
        <div>
          <LazySmartsheetFormValidationInput
            v-if="getMaxValidator"
            :column="activeField"
            :validator="getMaxValidator"
            @update-validation-value="updateColMeta(activeField)"
          >
            <template #prefix> Maximum</template>
            <template v-if="UITypes.Currency && activeField?.meta?.currency_code" #suffix>
              {{ activeField?.meta?.currency_code }}</template
            >
          </LazySmartsheetFormValidationInput>
          <LazySmartsheetFormValidationInputError :type="getValidationType.Max" />
        </div>
      </div>
    </div>

    <a-switch
      :checked="isLimitEnabled"
      size="small"
      class="flex-none nc-form-switch-focus"
      @change="addPlaceholderValidators($event, 'minMax')"
    />
  </div>
</template>
