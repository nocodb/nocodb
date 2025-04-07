<script lang="ts" setup>
const {
  isOpenUpgradePlanModal,
  paymentMode,
  annualDiscount,
  onPaymentModeChange,
  workspaceSeatCount,
  upgradePlan,
  getPlanPrice,
  updateSubscription,
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

const isLoading = ref(false)

const handleProceed = async () => {
  isLoading.value = true

  try {
    await updateSubscription(upgradePlan.value!.id)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}

watchEffect(() => {
  console.log('price', priceInfo.value, upgradePlan.value)
})
</script>

<template>
  <NcModal v-model:visible="isOpenUpgradePlanModal" size="md" wrap-class-name="nc-plan-upgrade-modal" height="auto">
    <div class="h-full flex flex-col">
      <div class="pl-4 pr-2 py-2 w-full flex items-center justify-between gap-3 border-b-1 border-nc-border-gray-medium">
        <div class="flex-1 text-xl text-nc-content-gray-emphasis font-700">Upgrade Plan</div>
        <NcButton size="small" type="text" @click="isOpenUpgradePlanModal = false">
          <GeneralIcon icon="close" class="text-gray-600" />
        </NcButton>
      </div>
      <div class="flex-1 nc-scrollbar-thin">
        <div class="px-4 py-6 flex gap-6 flex-col md:flex-row">
          <div class="flex flex-col gap-8 text-nc-content-gray-subtle2">
            <div>
              <div class="nc-upgrade-info-subtitle">
                This workspace has <span class="nc-upgrade-info-title"> {{ workspaceSeatCount }} billable users.</span>
              </div>
              <div class="nc-upgrade-info-subtitle mt-1">
                Credits from the unused portion of your current billing period will be applied to your new plan’s invoice.
              </div>
            </div>

            <div class="nc-upgrade-info-section">
              <div class="nc-upgrade-info-title">Invoice Update</div>
              <div class="nc-upgrade-info-subtitle">
                Your new {{ paymentMode === 'year' ? 'yearly' : 'monthly' }} charge will be
                <span class="nc-upgrade-info-title">${{ priceInfo.price }} (+ applicable taxes)</span>, effective from the next
                invoice.
              </div>
            </div>
            <div class="nc-upgrade-info-section">
              <div class="nc-upgrade-info-title">Billing Period Reset</div>
              <div class="nc-upgrade-info-subtitle">
                Upgrading your plan will reset your billing period, and you will be charged
                {{ paymentMode === 'year' ? 'yearly' : 'monthly' }} from the upgrade date.
              </div>
            </div>
          </div>
          <div>
            <div class="w-[380px] rounded-xl border-1 border-nc-bg-gray-medium bg-nc-bg-gray-extralight p-5 flex flex-col gap-5">
              <div class="flex items-center justify-between gap-3">
                <div class="text-nc-content-gray-emphasis text-base font-700">Billing Summary</div>
                <PaymentPlansSelectMode
                  :value="paymentMode"
                  :discount="annualDiscount"
                  class="text-xs nc-upgrade-plan-select-mode"
                  @change="onPaymentModeChange"
                />
              </div>

              <NcDivider class="!my-0" />
              <div class="flex flex-col gap-4">
                <div class="flex text-nc-content-gray gap-2">
                  <div class="flex-1 flex flex-col gap-1">
                    <div>{{ upgradePlan?.title }} Plan Seat</div>
                    <div class="text-xs text-nc-content-gray-muted leading-[18px]">
                      Paid
                      {{ paymentMode === 'year' ? 'yearly' : 'monthly' }}
                    </div>
                  </div>
                  <div>x{{ workspaceSeatCount }}</div>
                  <div class="min-w-[100px] text-right">${{ priceInfo.price + priceInfo.discount }}</div>
                </div>
                <div class="flex justify-between text-nc-content-gray text-sm font-500">
                  <div>Annual Savings</div>

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
                  <div>+ applicable tax</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="flex items-center justify-end gap-2 pl-4 pr-2 py-2 border-t-1 border-nc-border-gray-medium">
        <NcButton size="small" type="secondary" @click="isOpenUpgradePlanModal = false"> Cancel </NcButton>
        <NcButton size="small" :loading="isLoading" @click="handleProceed"> Proceed </NcButton>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
.nc-upgrade-info-section {
  @apply flex flex-col gap-2;
}
.nc-upgrade-info-title {
  @apply text-nc-content-gray-emphasis text-sm font-700;
}
.nc-upgrade-info-subtitle {
  @apply text-nc-content-gray-subtle2 text-sm;
}

.nc-upgrade-plan-select-mode {
  :deep(.tab) {
    @apply h-7;
  }
}
</style>

<style lang="scss">
.nc-plan-upgrade-modal {
  .nc-modal {
    @apply !p-0;
    height: auto;
    min-height: auto;

    .nc-edit-or-add-integration-left-panel {
      @apply w-full p-6 flex-1 flex justify-center;
    }
    .nc-edit-or-add-integration-right-panel {
      @apply p-5 w-[320px] border-l-1 border-gray-200 flex flex-col gap-4 bg-gray-50 rounded-br-2xl;
    }
  }
}
</style>
