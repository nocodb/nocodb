<script lang="ts" setup>
const {
  isOpenUpgradePlanModal,
  paymentMode,
  annualDiscount,
  onPaymentModeChange,
  workspaceSeatCount,
  upgradePlan,
  getPlanPrice,
} = usePaymentStoreOrThrow()

const priceInfo = computed(() => {
  const p = getPlanPrice(upgradePlan.value!)

  let total = p * workspaceSeatCount.value

  const pMonthly = getPlanPrice(upgradePlan.value!, 'month')

  let discount = 0

  if (paymentMode.value === 'year') {
    total = total * 12

    discount = pMonthly * 12 * workspaceSeatCount.value - total

    if (discount < 0) {
      discount = 0
    }
  }

  return {
    price: total,
    discount,
  }
})

watchEffect(() => {
  console.log('price', priceInfo.value, upgradePlan.value)
})
</script>

<template>
  <NcModal v-model:visible="isOpenUpgradePlanModal" size="md" wrap-class-name="nc-plan-upgrade-modal">
    <div class="h-full flex flex-col">
      <div class="pl-4 pr-2 py-2 w-full flex items-center justify-between gap-3 border-b-1 border-nc-border-gray-medium">
        <div class="flex-1 text-xl text-nc-content-gray-emphasis font-700">
          {{ $t('labels.upgradePlan') }}
        </div>
        <NcButton size="small" type="text" @click="isOpenUpgradePlanModal = false">
          <GeneralIcon icon="close" class="text-gray-600" />
        </NcButton>
      </div>
      <div class="flex-1 nc-scrollbar-thin">
        <div class="p-4 flex gap-6 flex-col md:flex-row">
          <div class="flex flex-col gap-8 text-nc-content-gray-subtle2">
            <PaymentPlansSelectMode :value="paymentMode" :discount="annualDiscount" @change="onPaymentModeChange" />
            <div class="nc-upgrade-info-subtitle">There are {{ workspaceSeatCount }} billable users on this workspace</div>
            <div class="nc-upgrade-info-section">
              <div class="nc-upgrade-info-title">Plan Upgradation Savings</div>
              <div class="nc-upgrade-info-subtitle">There are 4 billable users on this workspace</div>
            </div>
            <div class="nc-upgrade-info-section">
              <div class="nc-upgrade-info-title">Invoice Update</div>
              <div class="nc-upgrade-info-subtitle">
                You will owe <span class="nc-upgrade-info-title">${{ priceInfo.price }}</span> per {{ paymentMode }} (+ applicable
                taxes) {{ $t(`general.${paymentMode === 'year' ? 'yearly' : 'monthly'}`).toLowerCase() }}, starting from the next
                invoice.
              </div>
            </div>
            <div class="nc-upgrade-info-section">
              <div class="nc-upgrade-info-title">Billing Period will be Reset</div>
              <div class="nc-upgrade-info-subtitle">
                When you upgrade your plan, your billing period will reset, and you will be charged
                {{ $t(`general.${paymentMode === 'year' ? 'yearly' : 'monthly'}`).toLowerCase() }} from the upgrade date.
              </div>
            </div>
          </div>
          <div>
            <div class="w-[380px] rounded-xl border-1 border-nc-bg-gray-medium bg-nc-bg-gray-extralight p-5 flex flex-col gap-5">
              <div class="text-nc-content-gray-emphasis text-base font-700">Billing Summary</div>
              <NcDivider class="!my-0" />
              <div class="flex flex-col gap-4">
                <div class="flex text-nc-content-gray gap-2">
                  <div class="flex-1 flex flex-col gap-1">
                    <div>Business Plan Seat</div>
                    <div class="text-xs text-nc-content-gray-muted leading-[18px]">
                      {{ $t('general.paid') }}
                      {{ $t(`general.${paymentMode === 'year' ? 'yearly' : 'monthly'}`).toLowerCase() }}
                    </div>
                  </div>
                  <div>x{{ workspaceSeatCount }}</div>
                  <div class="min-w-[100px] text-right">${{ priceInfo.price + priceInfo.discount }}</div>
                </div>
                <div
                  v-if="paymentMode === 'year' && priceInfo.discount > 0"
                  class="flex justify-between text-nc-content-gray text-sm font-500"
                >
                  <div>{{ $t('labels.annualSavings') }}</div>

                  <NcBadge :border="false" color="green" class="!text-nc-content-green-dark !font-500">
                    -${{ priceInfo.discount }}
                  </NcBadge>
                </div>
              </div>
              <NcDivider class="!my-0" />
              <div>
                <div class="flex text-nc-content-gray text-base font-700 gap-2">
                  <div class="flex-1">Estimated Total</div>
                  <div>${{ priceInfo.price }}</div>
                </div>
                <div class="mt-1 flex text-nc-content-gray-muted text-xs gap-12">
                  <div class="flex-1">You may be charged less after receiving credits for the remainder of your current plan</div>
                  <div>+applicable tax</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="flex items-center justify-end gap-2 pl-4 pr-2 py-2 border-t-1 border-nc-border-gray-medium">
        <NcButton size="small" type="secondary" @click="isOpenUpgradePlanModal = false">
          {{ $t('labels.cancel') }}
        </NcButton>
        <NcButton size="small">
          {{ $t('labels.proceed') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
.nc-upgrade-info-section {
  @apply flex flex-col gap-3;

  .nc-upgrade-info-title {
    @apply text-nc-content-gray-emphasis text-sm font-700;
  }
  .nc-upgrade-info-subtitle {
    @apply text-nc-content-gray-subtle2 text-sm;
  }
}
</style>

<style lang="scss">
.nc-plan-upgrade-modal {
  .nc-modal {
    @apply !p-0;

    .nc-edit-or-add-integration-left-panel {
      @apply w-full p-6 flex-1 flex justify-center;
    }
    .nc-edit-or-add-integration-right-panel {
      @apply p-5 w-[320px] border-l-1 border-gray-200 flex flex-col gap-4 bg-gray-50 rounded-br-2xl;
    }
  }
}
</style>
