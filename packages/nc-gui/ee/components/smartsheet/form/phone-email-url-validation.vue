<script setup lang="ts">
import { PlanFeatureTypes, PlanTitles, StringValidationType, UITypes, type Validation } from 'nocodb-sdk'

const validatorMap = {
  [UITypes.Email]: StringValidationType.Email,
  [UITypes.PhoneNumber]: StringValidationType.PhoneNumber,
  [UITypes.URL]: StringValidationType.Url,
}

const { activeField, updateColMeta } = useFormViewStoreOrThrow()

const { getPlanTitle } = useEeConfig()

const isDefaultValidateEnabled = computed(() => !!parseProp(activeField.value?.meta)?.validate)

const isValidateEnabled = computed(() => {
  return !!(
    activeField.value &&
    ((activeField.value.meta.validators || []) as Validation[]).find((val) => {
      return val.type === validatorMap[activeField.value.uidt]
    })
  )
})
const isBusinessEmailEnabled = computed(() => {
  return !!(
    activeField.value &&
    ((activeField.value.meta.validators || []) as Validation[]).find((val) => {
      return val.type === StringValidationType.BusinessEmail
    })
  )
})

const title = computed(() => {
  if (activeField.value?.uidt === UITypes.Email) {
    return 'Validate email'
  }
  if (activeField.value?.uidt === UITypes.PhoneNumber) {
    return 'Validate phone number'
  }
  if (activeField.value?.uidt === UITypes.URL) {
    return 'Validate URL'
  }
})

const addPlaceholderValidators = (value, type: 'validate' | 'businessEmail') => {
  if (!activeField.value) return

  switch (type) {
    case 'validate': {
      if (value) {
        activeField.value.meta.validators = [
          ...(activeField.value.meta.validators || []),
          {
            type: validatorMap[activeField.value.uidt],
          },
        ]
      } else {
        activeField.value.meta.validators = ((activeField.value.meta.validators || []) as Validation[]).filter((val) => {
          return ![validatorMap[activeField.value.uidt], StringValidationType.BusinessEmail].includes(val.type)
        })
      }
      updateColMeta(activeField.value)
      break
    }
    case 'businessEmail': {
      if (value) {
        activeField.value.meta.validators = [
          ...(activeField.value.meta.validators || []),
          {
            type: StringValidationType.BusinessEmail,
          },
        ]
      } else {
        activeField.value.meta.validators = ((activeField.value.meta.validators || []) as Validation[]).filter((val) => {
          return val.type !== StringValidationType.BusinessEmail
        })
      }
      updateColMeta(activeField.value)
      break
    }
  }
}
</script>

<template v-if="activeField">
  <div class="w-full flex items-center justify-between gap-3">
    <div class="max-w-[calc(100%_-_40px)]">
      <div
        class="font-medium text-nc-content-gray"
        :class="{
          'cursor-pointer select-none': !isDefaultValidateEnabled,
        }"
        @click="
          () => {
            if (!isDefaultValidateEnabled) {
              addPlaceholderValidators(!isValidateEnabled, 'validate')
            }
          }
        "
      >
        {{ title }}
      </div>
    </div>

    <NcTooltip v-if="isDefaultValidateEnabled" class="flex" placement="topRight">
      <template #title> Validations enforced by field schema settings</template>
      <a-switch
        :checked="isDefaultValidateEnabled"
        :disabled="true"
        size="small"
        class="flex-none nc-form-switch-focus"
        :data-testid="`nc-form-field-validate-${activeField?.uidt}`"
      />
    </NcTooltip>

    <a-switch
      v-else
      :checked="isValidateEnabled"
      size="small"
      class="flex-none nc-form-switch-focus"
      :data-testid="`nc-form-field-validate-${activeField?.uidt}`"
      @change="addPlaceholderValidators($event, 'validate')"
    />
  </div>

  <PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION">
    <template #default="{ click }">
      <div
        v-if="activeField?.uidt === UITypes.Email && (isValidateEnabled || isDefaultValidateEnabled)"
        class="w-full flex items-center justify-between gap-3"
      >
        <div class="max-w-[calc(100%_-_40px)]">
          <div
            class="font-medium text-nc-content-gray cursor-pointer select-none flex items-center gap-2"
            @click="
              click(
                PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION,
                () => addPlaceholderValidators(!isBusinessEmailEnabled, 'businessEmail'),
                isBusinessEmailEnabled,
              )
            "
          >
            Accept only work email
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
        </div>

        <a-switch
          :checked="isBusinessEmailEnabled"
          size="small"
          class="flex-none nc-form-switch-focus"
          data-testid="nc-form-field-allow-only-work-email"
          @change="
            click(
              PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION,
              () => addPlaceholderValidators($event, 'businessEmail'),
              isBusinessEmailEnabled,
            )
          "
        />
      </div>
    </template>
  </PaymentUpgradeBadgeProvider>
</template>
