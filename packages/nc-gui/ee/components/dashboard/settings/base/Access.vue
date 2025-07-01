<script setup lang="ts">
import { PlanFeatureTypes, PlanTitles } from 'nocodb-sdk'

const { t } = useI18n()

const { blockPrivateBases, showUpgradeToUsePrivateBases } = useEeConfig()

const { base } = storeToRefs(useBase())

const baseAccessValue = computed({
  get: () => base.value?.is_private === true,
  set: (value) => {
    // If private base is selected and user don't have access to it then don't allow to select it
    if (value && showUpgradeToUsePrivateBases()) return

    // Todo: @rameshmane7218 update backend
    base.value.is_private = value
  },
})

const baseAccessOptions = computed(() => [
  {
    label: t('general.default'),
    value: false,
    icon: 'ncUsers',
    subtext: t('title.baseAccessSettingsDefaultSubtext'),
  },
  {
    label: t('general.private'),
    value: true,
    icon: 'ncUser',
    subtext: t('title.baseAccessSettingsPrivateSubtext'),
    disabled: blockPrivateBases.value,
  },
])
</script>

<template>
  <div data-testid="nc-settings-subtab-visibility" class="item-card flex flex-col w-full">
    <div class="flex items-center justify-between">
      <div class="text-nc-content-gray-emphasis font-semibold text-lg">
        {{ $t('general.baseAccess') }}
      </div>
      <div>
        <!-- Todo: @rameshmane7218 update link  -->
        <a
          href="https://nocodb.com/docs/product-docs/bases/base-access"
          target="_blank"
          rel="noopener noreferrer"
          class="!text-gray-700 text-sm !no-underline !hover:underline"
        >
          {{ $t('title.docs') }}
        </a>
      </div>
    </div>

    <div class="text-nc-content-gray-subtle2 mt-2 leading-5">
      {{ $t('title.baseAccessTabSubtext') }}
    </div>

    <div class="mt-8">
      <a-form-item class="!w-full">
        <a-radio-group v-model:value="baseAccessValue" class="nc-base-access-radio-group">
          <a-radio v-for="(option, idx) of baseAccessOptions" :key="idx" :value="option.value" :disabled="option.disabled">
            <div class="w-full flex flex-col">
              <div class="w-full flex items-center gap-2">
                <div
                  class="flex items-center gap-2"
                  :class="{
                    'text-nc-content-inverted-primary-disabled': option.disabled,
                    'text-nc-content-gray': !option.disabled,
                  }"
                >
                  <GeneralIcon :icon="option.icon" class="flex-none h-4 w-4" />
                  <span class="text-captionDropdownDefault">{{ option.label }}</span>
                </div>

                <PaymentUpgradeBadge
                  v-if="blockPrivateBases && option.value"
                  :feature="PlanFeatureTypes.FEATURE_PRIVATE_BASES"
                  :plan-title="PlanTitles.BUSINESS"
                  :content="
                    t('upgrade.upgradeToUsePrivateBasesSubtitle', {
                      plan: PlanTitles.BUSINESS,
                    })
                  "
                  size="sm"
                  class="!font-normal"
                />
              </div>
              <div
                class="text-bodyDefaultSm ml-6"
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
