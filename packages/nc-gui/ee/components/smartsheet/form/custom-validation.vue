<script setup lang="ts">
import type { Validation } from 'nocodb-sdk'
import { PlanFeatureTypes, PlanTitles, StringValidationType, UITypes, ValidationTypeLabel } from 'nocodb-sdk'

const { activeField, updateColMeta, v$ } = useFormViewStoreOrThrow()

const { getPlanTitle } = useEeConfig()

const validators = computed(() => {
  return activeField.value!.meta.validators as Validation[]
})

const validatorsMap = computed(() => {
  return (validators.value || []).reduce((acc, curr) => {
    if (curr.type) {
      acc[curr.type] = curr
    }
    return acc
  }, {} as Record<Exclude<Validation['type'], null>, Validation>)
})

const customValidatorTypes = computed(() => {
  return [
    StringValidationType.MinLength,
    StringValidationType.MaxLength,
    StringValidationType.StartsWith,
    StringValidationType.EndsWith,
    StringValidationType.Regex,
    ...(activeField.value?.uidt !== UITypes.PhoneNumber ? [StringValidationType.Includes, StringValidationType.NotIncludes] : []),
    null,
  ]
})

const filteredValidators = computed(() => {
  return validators.value.filter((v) => v.type && !isEmptyValidatorValue(v) && customValidatorTypes.value.includes(v.type))
})

const isOpen = ref(false)

const options = computed(() => {
  return Object.values(StringValidationType).reduce((acc, curr) => {
    if (customValidatorTypes.value.includes(curr)) {
      acc.push({
        value: curr,
        label: ValidationTypeLabel[curr],
      })
    }

    return acc
  }, [] as { value: StringValidationType; label: string }[])
})

const isCustomValidationSupported = computed(() =>
  [UITypes.SingleLineText, UITypes.LongText, UITypes.Email, UITypes.URL, UITypes.PhoneNumber].includes(activeField.value!.uidt),
)

const hasValidationError = computed(() => {
  if (!activeField.value) return false

  return !!v$.value?.[activeField.value.id]?.meta?.validators?.$error
})

const addPlaceholderValidator = () => {
  validators.value.push({
    type: null,
    value: null,
    message: '',
    regex: null,
  })
}

const handleRemoveValidator = (index: number) => {
  validators.value.splice(index, 1)
  updateColMeta(activeField.value!)
}

const removeEmptyValidators = () => {
  if (activeField.value && activeField.value?.meta?.validators) {
    const oldLength = (activeField.value?.meta?.validators || []).length

    activeField.value.meta.validators = (activeField.value.meta.validators || []).filter((v) => {
      return v.type
    })

    if (oldLength !== activeField.value.meta.validators.length) {
      updateColMeta(activeField.value)
    }
  }
}

watch(isOpen, (next) => {
  if (!next) {
    removeEmptyValidators()
  }
})

onMounted(() => {
  removeEmptyValidators()
})
</script>

<template>
  <div v-if="isCustomValidationSupported" class="p-4 border-b border-nc-border-gray-medium">
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <div class="text-nc-content-gray font-medium">Custom validations</div>

        <div class="flex flex-col">
          <PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION">
            <template #default="{ click, isFeatureEnabled }">
              <LazyPaymentUpgradeBadge
                v-if="!isFeatureEnabled && !validators.length"
                :feature="PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION"
                :content="
                  $t('upgrade.upgradeToAddCustomValidationSubtitle', {
                    plan: getPlanTitle(PlanTitles.PLUS),
                  })
                "
              />

              <NcDropdown
                v-else
                v-model:visible="isOpen"
                placement="bottomLeft"
                overlay-class-name="nc-custom-validator-dropdown"
              >
                <div
                  class="nc-custom-validation-btn border-1 rounded-lg py-1 px-3 flex items-center justify-between gap-2 !min-w-[170px] transition-all cursor-pointer select-none text-sm"
                  :class="{
                    '!border-nc-border-brand shadow-selected': isOpen,
                    'border-nc-border-gray-medium': !isOpen,
                    'bg-nc-bg-brand dark:bg-nc-bg-gray-light': filteredValidators.length,
                  }"
                  @click="isOpen = !isOpen"
                >
                  <div
                    class="nc-custom-validation-count flex-1"
                    :class="{
                      'text-nc-content-brand ': filteredValidators.length,
                    }"
                  >
                    {{
                      filteredValidators.length
                        ? `${filteredValidators.length} validation${filteredValidators.length !== 1 ? 's' : ''}`
                        : 'No validations'
                    }}
                  </div>

                  <GeneralIcon v-if="hasValidationError" icon="alertTriangle" class="flex-none !text-nc-content-red-medium" />

                  <GeneralIcon
                    icon="settings"
                    class="flex-none w-4 h-4"
                    :class="{
                      'text-nc-content-brand ': filteredValidators.length,
                    }"
                  />
                </div>
                <template #overlay>
                  <div class="p-4 nc-custom-validator-dropdown-container">
                    <div class="flex flex-col gap-3">
                      <div class="nc-custom-validation-table table">
                        <div class="thead">
                          <div class="tr">
                            <div class="th">Validator</div>
                            <div class="th">Validation Value</div>
                            <div class="th">
                              <span> Warning Message </span>
                              <NcTooltip class="flex cursor-pointer" placement="bottomLeft">
                                <template #title>
                                  This warning message will be displayed to form users for invalid inputs.</template
                                >

                                <GeneralIcon icon="info" class="flex-none text-nc-content-gray-muted hover:text-nc-content-gray-subtle" />
                              </NcTooltip>
                            </div>
                            <div class="th"></div>
                          </div>
                        </div>
                        <div class="tbody">
                          <template v-if="validators.length">
                            <template v-for="(validator, i) of validators" :key="i">
                              <LazySmartsheetFormCustomValidationItem
                                v-if="customValidatorTypes.includes(validator.type)"
                                class="tr"
                                :validator="validator"
                                :index="i"
                                :options="options"
                                :validators-map="validatorsMap"
                                @remove="handleRemoveValidator(i)"
                              ></LazySmartsheetFormCustomValidationItem>
                            </template>
                          </template>
                          <div v-else class="tr flex items-center justify-center text-nc-content-gray-muted">No validations</div>
                        </div>
                      </div>
                      <div>
                        <NcButton
                          class="nc-custom-validation-add-btn border-1 flex items-center"
                          type="link"
                          size="small"
                          @click="
                            () => {
                              if (click(PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION)) return

                              addPlaceholderValidator()
                            }
                          "
                        >
                          <div class="flex items-center gap-2">
                            <span class="text-sm"> Add Validation </span>
                            <GeneralIcon icon="plus" class="flex-none" />
                            <LazyPaymentUpgradeBadge
                              v-if="!isFeatureEnabled"
                              :feature="PlanFeatureTypes.FEATURE_FORM_FIELD_ON_CONDITION"
                              :content="$t('upgrade.upgradeToAddCustomValidationSubtitle')"
                            />
                          </div>
                        </NcButton>
                      </div>
                    </div>
                  </div>
                </template>
              </NcDropdown>
            </template>
          </PaymentUpgradeBadgeProvider>
        </div>
      </div>
      <div class="text-sm text-nc-content-gray-muted">Apply rules and regular expressions on inputs.</div>
    </div>
  </div>
</template>

<style lang="scss">
.nc-custom-validation-table {
  @apply border-none text-sm rounded-md;

  .thead .tr {
    @apply bg-nc-bg-gray-light rounded-t-lg;
  }

  .tbody {
    .tr {
      @apply border-t-0;
    }
    .tr:last-child {
      @apply rounded-b-lg;

      .td:last-child {
        @apply rounded-br-md;
      }
    }
  }

  .tr {
    @apply h-[32px] flex overflow-hidden border-1  border-nc-border-gray-medium;

    .th:not(:last-child),
    .td:not(:last-child) {
      @apply px-3 py-1 w-[174px] h-full;
    }

    .td:not(:last-child) {
      @apply p-0;
    }

    .th {
      @apply text-left uppercase text-nc-content-gray-muted font-semibold text-xs flex items-center justify-between;
    }

    .th:not(:last-child):not(:nth-last-child(2)) {
      @apply border-r-1  border-nc-border-gray-medium;
    }

    .th:last-child {
      @apply min-w-8;
    }

    .td:not(:last-child) {
      @apply border-r-1  border-nc-border-gray-medium;
    }
    .td:last-child {
      @apply px-0;
    }
  }
}
.nc-custom-validator-dropdown {
  @apply rounded-2xl border-nc-border-gray-medium;
  box-shadow: 0px 20px 24px -4px rgba(0, 0, 0, 0.1), 0px 8px 8px -4px rgba(0, 0, 0, 0.04);
}
</style>
