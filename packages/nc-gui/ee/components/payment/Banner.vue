<script lang="ts" setup>
import { LOYALTY_GRACE_PERIOD_END_DATE } from 'nocodb-sdk'
import loyalBgImage from '~/assets/img/loyalty-bg.png'
import loyalContentImage from '~/assets/img/loyal-upgrade-banner-content.png'
import loyalMoscotImage from '~/assets/img/loyal-upgrade-banner-moscot.png'

const _props = withDefaults(
  defineProps<{
    expanded?: boolean
  }>(),
  {
    expanded: true,
  },
)

const { isPaidPlan, isWsOwner, navigateToPricing, isLoyaltyWorkspace, isPaymentEnabled } = useEeConfig()
</script>

<template>
  <div
    v-if="isPaymentEnabled && !isPaidPlan"
    class="nc-payment-banner-wrapper z-1"
    :class="{
      'nc-payment-banner-expanded': expanded,
    }"
  >
    <div
      class="nc-payment-banner overflow-hidden relative flex justify-center gap-6 transition-all duration-300 bg-cover bg-no-repeat cursor-pointer nc-loyalty-payment-banner"
      :class="{
        'p-4 min-h-[66px]': !expanded,
        'px-8 py-6 min-h-[168px]': expanded,
      }"
      :style="{
        'background-image': `url(${loyalBgImage})`,
        'background-color': 'rgba(255, 255, 255, 0.7)',
        'background-blend-mode': 'overlay',
      }"
      @click.stop="navigateToPricing()"
    >
      <div
        class="flex"
        :class="{
          'justify-between w-full': !expanded,
          'flex-col': expanded,
        }"
      >
        <div class="text-xl font-weight-700 text-nc-content-gray leading-[32px]">
          {{ isLoyaltyWorkspace ? $t('title.loyaltyBannerTitle') : $t('title.getMoreFromNocodb') }}
        </div>
        <div v-if="expanded" class="mt-2">
          {{ isLoyaltyWorkspace ? $t('title.loyaltyBannerSubtitle') : $t('title.getMoreFromNocodbSubtitle') }}
        </div>
        <div
          class="flex gap-2 items-center"
          :class="{
            'flex-row-reverse': !expanded,
            'mt-5': expanded,
          }"
        >
          <NcButton
            class="nc-upgrade-plan-btn"
            data-testid="nc-workspace-settings-upgrade-button"
            inner-class="!gap-1"
            @click.stop="navigateToPricing()"
          >
            <template #icon>
              <GeneralIcon icon="ncArrowUpRight" class="!transition-none" />
            </template>
            <span class="font-semibold">
              {{ isWsOwner ? $t('labels.viewPlans') : $t('general.requestUpgrade') }}
            </span>
          </NcButton>

          <div v-if="isLoyaltyWorkspace">
            <PaymentExpiresIn
              :end-time="LOYALTY_GRACE_PERIOD_END_DATE"
              hide-icon
              class="!bg-transparent text-nc-content-purple-dark"
            />
          </div>
        </div>
      </div>
      <div class="w-[154px] hidden xl:block">
        <img :src="loyalMoscotImage" class="absolute -bottom-0" alt="Moscot" width="154px" height="160px" />
      </div>
      <div class="w-[min(495px,40%)] min-w-[405px] flex-none relative">
        <img :src="loyalContentImage" alt="Content" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-payment-banner {
  .nc-finance-img {
    -webkit-transform: scaleX(-1);
    transform: scaleX(-1);
  }
}

.nc-upgrade-plan-btn {
  @apply !border-0 px-2 !font-semibold !rounded-lg;
}

.nc-payment-banner {
  .nc-upgrade-plan-btn {
    @apply !bg-blue-200 !hover:bg-blue-300/80 !text-nc-content-gray-emphasis;
  }

  &:hover {
    .nc-upgrade-plan-btn {
      @apply !bg-blue-500 !hover:bg-blue-600 !text-white;
    }
  }
}

.nc-loyalty-payment-banner {
  .nc-upgrade-plan-btn {
    @apply !bg-purple-200 !hover:bg-purple-300/80 !text-nc-content-purple-dark;
  }
  &:hover {
    .nc-upgrade-plan-btn {
      @apply !bg-purple-500 !hover:bg-purple-600 !text-white;
    }
  }
}
</style>
