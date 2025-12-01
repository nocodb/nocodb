<script setup lang="ts">
import { NumberValidationType, PlanFeatureTypes, PlanTitles, UITypes, type Validation } from 'nocodb-sdk'

const { activeField, updateColMeta } = useFormViewStoreOrThrow()

const { getPlanTitle } = useEeConfig()

const isLimitRangeEnabled = computed(() => {
  return !!(
    activeField.value &&
    ((activeField.value.meta.validators || []) as Validation[]).find((val) => {
      return [NumberValidationType.Min, NumberValidationType.Max].includes(val.type)
    })
  )
})

const getMinValidator = computed(() => {
  return ((activeField.value?.meta.validators || []) as Validation[]).find((val) => {
    return val.type === NumberValidationType.Min
  })
})
const getMaxValidator = computed(() => {
  return ((activeField.value?.meta.validators || []) as Validation[]).find((val) => {
    return val.type === NumberValidationType.Max
  })
})

const title = computed(() => {
  if (!activeField.value) return 'Limit'

  if (isLink(activeField.value)) {
    return 'Limit records'
  } else {
    return `Limit ${activeField.value?.uidt?.toLowerCase() || 'number'} to a range`
  }
})
const subtitle = computed(() => {
  if (!activeField.value) return ''

  if (isLink(activeField.value)) {
    return 'Apply a limit on the number of records that can be linked.'
  } else {
    return ''
  }
})

const addPlaceholderValidators = (value, type: 'minMax') => {
  if (!activeField.value) return

  switch (type) {
    case 'minMax': {
      if (value) {
        activeField.value.meta.validators = [
          ...(activeField.value.meta.validators || []),
          {
            type: NumberValidationType.Min,
            value: null,
            message: '',
          },
          {
            type: NumberValidationType.Max,
            value: null,
            message: '',
          },
        ]
      } else {
        activeField.value.meta.validators = ((activeField.value.meta.validators || []) as Validation[]).filter((val) => {
          return ![NumberValidationType.Min, NumberValidationType.Max].includes(val.type)
        })
        updateColMeta(activeField.value)
      }
      break
    }
  }
}
</script>

<template>
  <PaymentUpgradeBadgeProvider v-if="activeField" :feature="PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION">
    <template #default="{ click }">
      <div class="w-full flex items-start justify-between gap-3">
        <div class="flex-1 max-w-[calc(100%_-_40px)]">
          <div
            class="font-medium text-nc-content-gray cursor-pointer select-none flex items-center gap-2"
            @click="
              click(
                PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION,
                () => addPlaceholderValidators(!isLimitRangeEnabled, 'minMax'),
                isLimitRangeEnabled,
              )
            "
          >
            {{ title }}

            <LazyPaymentUpgradeBadge
              class="-my-1"
              :feature="PlanFeatureTypes.FEATURE_HIDE_BRANDING"
              :content="
                $t('upgrade.upgradeToAccessFieldValidationSubtitle', {
                  plan: getPlanTitle(PlanTitles.PLUS),
                })
              "
            />
          </div>
          <div v-if="subtitle" class="text-nc-content-gray-muted mt-1">{{ subtitle }}</div>

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
                <template v-if="activeField.uidt === UITypes.Currency && activeField?.meta?.currency_code" #suffix>
                  {{ activeField?.meta?.currency_code }}</template
                >
              </LazySmartsheetFormValidationInput>
              <LazySmartsheetFormValidationInputError :type="NumberValidationType.Min" />
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
                <template v-if="activeField.uidt === UITypes.Currency && activeField?.meta?.currency_code" #suffix>
                  {{ activeField?.meta?.currency_code }}</template
                >
              </LazySmartsheetFormValidationInput>
              <LazySmartsheetFormValidationInputError :type="NumberValidationType.Max" />
            </div>
          </div>
        </div>

        <a-switch
          :checked="isLimitRangeEnabled"
          size="small"
          class="flex-none nc-form-switch-focus"
          :data-testid="`nc-limit-to-range-${activeField?.uidt}`"
          @change="
            click(
              PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION,
              () => addPlaceholderValidators($event, 'minMax'),
              isLimitRangeEnabled,
            )
          "
        />
      </div>
    </template>
  </PaymentUpgradeBadgeProvider>
</template>
