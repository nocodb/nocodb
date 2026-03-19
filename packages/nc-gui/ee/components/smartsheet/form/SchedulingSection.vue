<script setup lang="ts">
import dayjs from 'dayjs'
import type { FormType } from 'nocodb-sdk'
import { PlanFeatureTypes, PlanTitles } from 'nocodb-sdk'

interface Props {
  formViewData: FormType
  isLocked?: boolean
  isEditable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isLocked: false,
  isEditable: true,
})

const emit = defineEmits(['updateView'])

const { formViewData, isLocked, isEditable } = toRefs(props)

const { t } = useI18n()

const { showEEFeatures } = useEeConfig()

const isFormSchedulingOption = ref(false)

const isFormSchedulingEnabled = computed({
  get: () => {
    return (
      isFormSchedulingOption.value ||
      typeof formViewData.value?.starts_at === 'string' ||
      typeof formViewData.value?.expires_at === 'string'
    )
  },
  set: (value: boolean) => {
    isFormSchedulingOption.value = value
    if (!value) {
      formViewData.value.starts_at = null
      formViewData.value.expires_at = null
    }
    emit('updateView')
  },
})

const endDateValidationError = computed(() => {
  if (!formViewData.value?.expires_at || !formViewData.value?.starts_at) return ''

  if (dayjs(formViewData.value.expires_at).isSameOrBefore(dayjs(formViewData.value.starts_at))) {
    return t('labels.formEndDateBeforeStart')
  }

  return ''
})
</script>

<template>
  <div v-if="showEEFeatures" class="p-4 flex flex-col space-y-4 border-b border-nc-border-gray-medium">
    <!-- Form Scheduling -->
    <PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_FORM_SCHEDULING">
      <template #default="{ click }">
        <div class="flex items-center justify-between gap-3">
          <span class="flex items-center gap-3 text-sm font-bold text-nc-content-gray">
            {{ $t('labels.formScheduling') }}

            <LazyPaymentUpgradeBadge
              :feature="PlanFeatureTypes.FEATURE_FORM_SCHEDULING"
              :content="
                $t('upgrade.upgradeToUseFormSchedulingSubtitle', {
                  plan: PlanTitles.PLUS,
                })
              "
            />
          </span>
          <a-switch
            v-e="[`a:form-view:scheduling`]"
            :checked="isFormSchedulingEnabled"
            size="small"
            class="nc-form-checkbox-scheduling"
            data-testid="nc-form-checkbox-scheduling"
            :disabled="isLocked || !isEditable"
            @change="
              (value: boolean) => {
                if (value && click(PlanFeatureTypes.FEATURE_FORM_SCHEDULING)) return

                isFormSchedulingEnabled = !!value
              }
            "
          />
        </div>
      </template>
    </PaymentUpgradeBadgeProvider>
    <div class="flex flex-col gap-3 empty:hidden">
      <template v-if="isFormSchedulingEnabled">
        <!-- Start date -->
        <div class="flex flex-col gap-1.5">
          <span class="text-small text-nc-content-gray-subtle2">{{ $t('labels.formStartDate') }}</span>
          <NcDateTimePicker
            :model-value="formViewData.starts_at"
            :placeholder="$t('labels.formStartDate')"
            data-testid="nc-form-start-date-picker"
            :disabled="isLocked || !isEditable"
            @update:model-value="
              (value: string | null) => {
                formViewData.starts_at = value
                emit('updateView')
              }
            "
          />
        </div>

        <!-- Expiration date -->
        <div class="flex flex-col gap-1.5">
          <span class="text-small text-nc-content-gray-subtle2">{{ $t('labels.formExpirationDate') }}</span>
          <NcDateTimePicker
            :model-value="formViewData.expires_at"
            :placeholder="$t('labels.formExpirationDate')"
            data-testid="nc-form-expiration-picker"
            :disabled="isLocked || !isEditable"
            @update:model-value="
              (value: string | null) => {
                formViewData.expires_at = value
                emit('updateView')
              }
            "
          />
          <div v-if="endDateValidationError" class="text-nc-content-red-dark text-small leading-[18px]">
            {{ endDateValidationError }}
          </div>
        </div>

        <!-- Show expiry timer toggle -->
        <div v-if="formViewData?.expires_at" class="flex items-center justify-between gap-3">
          <span class="flex items-center gap-1 text-small text-nc-content-gray-subtle2">
            {{ $t('labels.formShowExpiryTimer') }}
            <NcTooltip>
              <template #title>
                {{ $t('labels.formShowExpiryTimerTooltip') }}
              </template>
              <GeneralIcon icon="info" class="w-3.5 h-3.5 text-nc-content-gray-muted cursor-help" />
            </NcTooltip>
          </span>
          <a-switch
            v-e="[`a:form-view:show-expiry-timer`]"
            :checked="!!parseProp(formViewData?.meta)?.show_expiry_timer"
            size="small"
            :disabled="isLocked || !isEditable"
            @change="
              (value: boolean) => {
                ;(formViewData!.meta as Record<string, any>).show_expiry_timer = value
                emit('updateView')
              }
            "
          />
        </div>
      </template>
    </div>
  </div>
</template>
