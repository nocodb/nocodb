<script setup lang="ts">
import { PlanFeatureTypes, PlanTitles, ProjectRoles } from 'nocodb-sdk'

const { t } = useI18n()

const { blockPrivateBases, showUpgradeToUsePrivateBases, isOnPrem } = useEeConfig()

const { base } = storeToRefs(useBase())

const { updateProject } = useBases()

const handleUpdateBaseType = async () => {
  try {
    await updateProject(base.value.id!, {
      default_role: base.value.default_role,
    })
  } catch (e: any) {
    console.error(e)
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const baseTypeValue = computed({
  get: () => base.value?.default_role === ProjectRoles.NO_ACCESS,
  set: (value) => {
    // If private base is selected and user don't have access to it then don't allow to select it
    if (value && showUpgradeToUsePrivateBases()) return

    base.value.default_role = value ? ProjectRoles.NO_ACCESS : ''

    handleUpdateBaseType()
  },
})

const baseTypeOptions = computed(() => [
  {
    label: t('labels.defaultType'),
    value: false,
    icon: 'ncBaseOutline',
    subtext: t('title.baseTypeSettingsDefaultSubtext'),
  },
  {
    label: t('labels.privateType'),
    value: true,
    icon: 'ncBasePrivate',
    subtext: t('title.baseTypeSettingsPrivateSubtext'),
    disabled: blockPrivateBases.value,
  },
])

const privateBaseMinPlanReq = computed(() => (isOnPrem.value ? PlanTitles.ENTERPRISE : PlanTitles.BUSINESS))
</script>

<template>
  <div data-testid="nc-settings-subtab-visibility" class="item-card flex flex-col w-full">
    <div class="flex items-center justify-between">
      <div class="text-nc-content-gray-emphasis font-semibold text-lg">
        {{ $t('general.baseType') }}
      </div>
      <div>
        <a
          href="https://nocodb.com/docs/product-docs/bases/private-base"
          target="_blank"
          rel="noopener noreferrer"
          class="!text-gray-700 text-sm !no-underline !hover:underline"
        >
          {{ $t('title.docs') }}
        </a>
      </div>
    </div>

    <div class="text-nc-content-gray-subtle2 mt-2 leading-5">
      {{ $t('title.baseTypeTabSubtext') }}
    </div>

    <div class="mt-8">
      <a-form-item class="!w-full">
        <a-radio-group v-model:value="baseTypeValue" class="nc-base-access-radio-group">
          <a-radio v-for="(option, idx) of baseTypeOptions" :key="idx" :value="option.value">
            <div class="w-full flex flex-col gap-1">
              <div class="w-full flex items-center gap-2">
                <div
                  class="flex items-center gap-3"
                  :class="{
                    'text-nc-content-inverted-primary-disabled': option.disabled,
                    'text-nc-content-gray': !option.disabled,
                  }"
                >
                  <GeneralIcon :icon="option.icon" class="flex-none h-4 w-4" />
                  <span class="font-semibold">{{ option.label }}</span>
                </div>

                <PaymentUpgradeBadge
                  v-if="blockPrivateBases && option.value"
                  :feature="PlanFeatureTypes.FEATURE_PRIVATE_BASES"
                  :plan-title="privateBaseMinPlanReq"
                  size="sm"
                  remove-click
                  class="!font-normal !text-bodyDefaultSm"
                />
              </div>
              <div
                class="ml-7"
                :class="{
                  'text-nc-content-inverted-primary-disabled': option.disabled,
                  'text-nc-content-gray-muted': !option.disabled,
                }"
              >
                {{ option.subtext }}
              </div>
            </div>
          </a-radio>
        </a-radio-group>
      </a-form-item>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.nc-base-access-radio-group.ant-radio-group) {
  @apply w-full border-1 border-nc-border-gray-medium rounded-lg;

  .ant-radio-wrapper {
    @apply !m-0 flex flex-row-reverse gap-2 p-3;
    &:first-of-type {
      @apply border-b-1 border-nc-border-gray-medium;
    }

    & span.ant-radio + span {
      @apply p-0 w-full;
    }

    &::after {
      @apply !hidden;
    }
  }
}
</style>
