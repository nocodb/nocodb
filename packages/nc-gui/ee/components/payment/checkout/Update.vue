<script lang="ts" setup>
import dayjs from 'dayjs'
import { PlanLimitTypes, PlanOrder, PlanTitles, SEAT_PRICE_CAP } from 'nocodb-sdk'

const props = defineProps<{
  plan: PaymentPlan
}>()

const { $e } = useNuxtApp()

const { navigateToPricing, getLimit } = useEeConfig()

const {
  activeWorkspace,
  activePlan,
  activeSubscription,
  paymentMode,
  annualDiscount,
  onPaymentModeChange,
  workspaceOrOrgSeatCount,
  getPlanPrice,
  updateSubscription,
  cancelSubscription,
} = usePaymentStoreOrThrow()

const formatMaxValue = (value: number) => {
  return isFinite(value) ? Number(value).toLocaleString() : 'Unlimited'
}

const changes = computed(() => {
  if (!activeSubscription.value) return {}

  const changes: {
    plan?: string
    price?: string
    period?: string
    decrease?: {
      title: string
      oldValue: string
      newValue: string
      percent: number | string
    }[]
    change?: 'upgrade' | 'downgrade' | 'cancel'
  } = {}

  if (activeSubscription.value.fk_plan_id !== props.plan.id) {
    changes.plan = props.plan.title
  }

  const activePrice =
    getPlanPrice(activePlan.value, activeSubscription.value.period) * (activeSubscription.value.period === 'year' ? 12 : 1)

  const newPrice = getPlanPrice(props.plan, paymentMode.value) * (paymentMode.value === 'year' ? 12 : 1)

  if (activePrice !== newPrice) {
    changes.price = newPrice > activePrice ? 'charges' : 'no-charges'
  }

  if (activeSubscription.value.period !== paymentMode.value) {
    changes.period = paymentMode.value
  }

  if (props.plan.title === PlanTitles.FREE) {
    changes.change = 'cancel'

    changes.decrease = [
      ...(workspaceOrOrgSeatCount.value > 3
        ? [
            {
              title: 'Number of editors',
              oldValue: `${workspaceOrOrgSeatCount.value}`,
              newValue: '3',
              percent: (((workspaceOrOrgSeatCount.value - 3) / workspaceOrOrgSeatCount.value) * 100).toFixed(2),
            },
          ]
        : []),
      {
        title: 'Storage (GB)',
        oldValue: `${formatMaxValue(Number(getLimit(PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE) / 1000))}`,
        newValue: '1 GB',
        percent: isFinite(getLimit(PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE))
          ? (
              ((getLimit(PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE) / 1000 - 1) /
                (getLimit(PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE) / 1000)) *
              100
            ).toFixed(2)
          : '100',
      },
      {
        title: 'API calls (monthly)',
        oldValue: `${formatMaxValue(getLimit(PlanLimitTypes.LIMIT_API_CALL))}`,
        newValue: '1,000 requests',
        percent: isFinite(getLimit(PlanLimitTypes.LIMIT_API_CALL))
          ? (((getLimit(PlanLimitTypes.LIMIT_API_CALL) - 1000) / getLimit(PlanLimitTypes.LIMIT_API_CALL)) * 100).toFixed(2)
          : '100',
      },
      {
        title: 'Webhook calls (monthly)',
        oldValue: `${formatMaxValue(Number(getLimit(PlanLimitTypes.LIMIT_AUTOMATION_RUN)))}`,
        newValue: '100 calls',
        percent: isFinite(getLimit(PlanLimitTypes.LIMIT_AUTOMATION_RUN))
          ? (
              ((getLimit(PlanLimitTypes.LIMIT_AUTOMATION_RUN) - 1000) / getLimit(PlanLimitTypes.LIMIT_AUTOMATION_RUN)) *
              100
            ).toFixed(2)
          : '100',
      },
    ]
  } else {
    changes.change = PlanOrder[activePlan.value?.title as PlanTitles] <= PlanOrder[props.plan.title] ? 'upgrade' : 'downgrade'
  }

  return changes
})

const priceInfo = computed(() => {
  const p = getPlanPrice(props.plan)

  let total = p * Math.min(workspaceOrOrgSeatCount.value, SEAT_PRICE_CAP)

  const pMonthly = getPlanPrice(props.plan, 'month')

  let discount = 0

  if (paymentMode.value === 'year') {
    total = total * 12

    discount = pMonthly * 12 * Math.min(workspaceOrOrgSeatCount.value, SEAT_PRICE_CAP) - total

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
  if (!changes.value.plan && !changes.value.period) {
    navigateToPricing({ isBackToPricing: true })
    return
  }

  isLoading.value = true

  $e(`a:payment:checkout:update-subscription`, {
    activePlan: activePlan.value?.title,
    newPlan: changes.value.plan,
    newPeriod: changes.value.period,
  })

  try {
    await updateSubscription(props.plan.id, undefined, changes.value.change === 'upgrade' && changes.value.plan)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}

const onCancelSubscription = async () => {
  isLoading.value = true

  $e(`a:payment:checkout:cancel-subscription`, {
    activePlan: activePlan.value?.title,
  })

  try {
    await cancelSubscription()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="h-full flex flex-col w-full max-w-[676px] mx-auto px-6">
    <div class="sticky top-0 bg-white pt-5 -mt-5 -mx-6 px-6">
      <PaymentCheckoutHeader
        v-if="changes.change === 'upgrade'"
        :title="changes.plan || !changes.period || changes.period === 'year' ? 'Upgrade Plan' : 'Change Billing Period'"
        @back="navigateToPricing({ isBackToPricing: true })"
      />

      <PaymentCheckoutHeader
        v-else-if="changes.change === 'downgrade'"
        title="Downgrade Plan"
        @back="navigateToPricing({ isBackToPricing: true })"
      />

      <PaymentCheckoutHeader
        v-else-if="changes.change === 'cancel'"
        title="Downgrade to Free Plan"
        @back="navigateToPricing({ isBackToPricing: true })"
      />

      <NcDivider class="!mb-0 !mt-6" />
    </div>

    <div
      v-if="changes.change === 'upgrade' && (changes.plan || !changes.period || changes.period === 'year')"
      class="flex-1 nc-scrollbar-thin"
    >
      <div class="py-6 flex gap-6 flex-col">
        <div class="flex flex-col gap-8 text-nc-content-gray-subtle2">
          <div>
            <div class="nc-upgrade-info-subtitle">
              This workspace has <span class="nc-upgrade-info-title"> {{ workspaceOrOrgSeatCount }} billable users.</span>
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
          <div class="rounded-xl border-1 border-nc-bg-gray-medium bg-nc-bg-gray-extralight p-5 flex flex-col gap-5">
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
                  <div>{{ plan?.title }} Plan Seat</div>
                  <div class="text-xs text-nc-content-gray-muted leading-[18px]">
                    Paid
                    {{ paymentMode === 'year' ? 'yearly' : 'monthly' }}
                  </div>
                </div>
                <div>x{{ workspaceOrOrgSeatCount }}</div>
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

    <!-- If changing to monthly - changes will be applied on period end -->
    <div v-else-if="changes.change === 'upgrade' && changes.period === 'month'" class="flex-1 nc-scrollbar-thin">
      <div class="py-6 flex gap-6 flex-col">
        <div class="flex flex-col gap-4 text-nc-content-gray-subtle2">
          <div>
            <div class="nc-upgrade-info-subtitle">
              The {{ activeWorkspace?.title ?? 'Workspace' }} workspace is currently subscribed to the
              <span class="font-bold"
                >{{ activePlan?.title }} ({{ activeSubscription.period === 'month' ? 'Monthly' : 'Annual' }})</span
              >
              plan.
            </div>
            <div class="nc-upgrade-info-subtitle mt-1">
              You are about to switch to the
              <span class="font-bold">{{ props.plan.title }} ({{ paymentMode === 'month' ? 'Monthly' : 'Annual' }})</span> plan.
            </div>
            <div class="flex flex-col">
              <div class="flex items-start text-nc-content-gray-subtle text-sm leading-[24px] font-weight-500">
                <span class="mr-2 h-6 inline-flex items-center">
                  <span class="rounded inline-flex items-center justify-center h-4 w-4"> • </span>
                </span>
                <span class="relative"> <span class="font-bold">Billable users:</span> {{ workspaceOrOrgSeatCount }}</span>
              </div>
              <div class="flex items-start text-nc-content-gray-subtle text-sm leading-[24px] font-weight-500">
                <span class="mr-2 h-6 inline-flex items-center">
                  <span class="rounded inline-flex items-center justify-center h-4 w-4"> • </span>
                </span>
                <span class="relative">
                  <span class="font-bold">Effective date:</span> The downgrade will take effect at the end of your current billing
                  cycle.</span
                >
              </div>
            </div>
          </div>
          <div class="nc-upgrade-info-section">
            <div class="nc-upgrade-info-title">Invoice Update</div>
            <div class="nc-upgrade-info-subtitle">
              Your new {{ paymentMode === 'year' ? 'yearly' : 'monthly' }} charge will be
              <span class="nc-upgrade-info-title"> ${{ priceInfo.price }} (+ applicable taxes)</span>, effective from the next
              invoice.
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="changes.change === 'downgrade'" class="flex-1 nc-scrollbar-thin">
      <div class="py-6 flex gap-6 flex-col">
        <div class="w-full flex justify-center">
          <PaymentPlansSelectMode
            :value="paymentMode"
            :discount="annualDiscount"
            class="text-xs nc-upgrade-plan-select-mode"
            @change="onPaymentModeChange"
          />
        </div>

        <div class="flex flex-col gap-4 text-nc-content-gray-subtle2">
          <div>
            <div class="nc-upgrade-info-subtitle">
              The {{ activeWorkspace?.title ?? 'Workspace' }} workspace is currently subscribed to the
              <span class="font-bold"
                >{{ activePlan?.title }} ({{ activeSubscription.period === 'month' ? 'Monthly' : 'Annual' }})</span
              >
              plan.
            </div>
            <div class="nc-upgrade-info-subtitle mt-1">
              You are about to switch to the
              <span class="font-bold">{{ props.plan.title }} ({{ paymentMode === 'month' ? 'Monthly' : 'Annual' }})</span> plan.
            </div>
            <div class="flex flex-col">
              <div class="flex items-start text-nc-content-gray-subtle text-sm leading-[24px] font-weight-500">
                <span class="mr-2 h-6 inline-flex items-center">
                  <span class="rounded inline-flex items-center justify-center h-4 w-4"> • </span>
                </span>
                <span class="relative"> <span class="font-bold">Billable users:</span> {{ workspaceOrOrgSeatCount }}</span>
              </div>
              <div class="flex items-start text-nc-content-gray-subtle text-sm leading-[24px] font-weight-500">
                <span class="mr-2 h-6 inline-flex items-center">
                  <span class="rounded inline-flex items-center justify-center h-4 w-4"> • </span>
                </span>
                <span class="relative">
                  <span class="font-bold">Effective date:</span> The downgrade will take effect at the end of your current billing
                  cycle.</span
                >
              </div>
            </div>
          </div>
          <div class="nc-upgrade-info-section">
            <div class="nc-upgrade-info-title">Invoice Update</div>
            <div class="nc-upgrade-info-subtitle">
              Your new {{ paymentMode === 'year' ? 'yearly' : 'monthly' }} charge will be
              <span class="nc-upgrade-info-title"> ${{ priceInfo.price }} (+ applicable taxes)</span>, effective from the next
              invoice.
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="changes.change === 'cancel'" class="flex-1 nc-scrollbar-thin">
      <div class="py-6 flex gap-6 flex-col">
        <div class="flex flex-col gap-6 text-nc-content-gray-subtle2">
          <div class="font-bold text-nc-content-gray text-base">Before you cancel your plan</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div
              v-for="decrease of changes.decrease"
              :key="decrease.title"
              class="bg-nc-bg-red-light rounded-xl p-4 border-1 border-nc-border-gray-medium flex flex-col gap-2"
            >
              <div class="flex items-center gap-3 text-nc-content-red-dark">
                <span class="text-2xl font-700">-{{ decrease.percent }}%</span>
                <GeneralIcon icon="ncArrowDownCircle" class="h-4 w-4" />
              </div>
              <div class="w-full flex items-center gap-3 text-nc-content-gray text-sm">
                {{ decrease.oldValue }}
                <GeneralIcon icon="ncArrowRight" class="text-nc-content-gray-subtle h-4 w-4" />
                {{ decrease.newValue }}
              </div>
              <div class="text-nc-content-gray font-semibold text-sm">{{ decrease.title }}</div>
            </div>
          </div>
          <div class="font-bold text-nc-content-gray text-base">You will no longer have access to following features:</div>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-nc-content-gray">
            <div class="flex items-center gap-3 font-semibold">
              <div class="flex items-center justify-center p-2 bg-nc-bg-purple-light rounded-lg">
                <GeneralIcon icon="form" class="text-nc-content-purple-dark" />
              </div>
              <span>Form Branding</span>
            </div>
            <div class="flex items-center gap-3 font-semibold">
              <div class="flex items-center justify-center p-2 bg-nc-bg-gray-light rounded-lg">
                <GeneralIcon icon="sso" class="text-nc-content-gray-subtle" />
              </div>
              <span>Single Sign-On (SSO)</span>
            </div>
            <div class="flex items-center gap-3 font-semibold">
              <div class="flex items-center justify-center p-2 bg-nc-bg-maroon-light rounded-lg">
                <GeneralIcon icon="integration" />
              </div>
              <span>Integrations</span>
            </div>
            <div class="flex items-center gap-3 font-semibold">
              <div class="flex items-center justify-center p-2 bg-nc-bg-purple-light rounded-lg">
                <GeneralIcon icon="ncPuzzleOutline" class="!stroke-transparent text-nc-fill-purple-dark" />
              </div>
              <span>Extensions</span>
            </div>
          </div>
          <div class="text-sm">
            You will still have access to all paid features until your plan changes to the Free plan at the end of your billing
            cycle on {{ dayjs(activeSubscription?.upcoming_invoice_at).format('MMMM D, YYYY') }}.
          </div>
        </div>
      </div>
    </div>
    <div
      v-if="changes.change === 'cancel'"
      class="flex items-center justify-end gap-2 py-6 border-t-1 border-nc-border-gray-medium"
    >
      <NcButton class="w-1/2" type="secondary" @click="navigateToPricing({ isBackToPricing: true })"> Cancel </NcButton>
      <NcButton
        class="w-1/2"
        type="danger"
        :loading="isLoading"
        :disabled="!changes.plan && !changes.period"
        @click="onCancelSubscription()"
      >
        Proceed
      </NcButton>
    </div>
    <div v-else class="flex items-center justify-end gap-2 py-6 border-t-1 border-nc-border-gray-medium">
      <NcButton class="w-1/2" type="secondary" @click="navigateToPricing({ isBackToPricing: true })"> Cancel </NcButton>
      <NcButton class="w-1/2" :loading="isLoading" :disabled="!changes.plan && !changes.period" @click="handleProceed">
        Proceed
      </NcButton>
    </div>
  </div>
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
