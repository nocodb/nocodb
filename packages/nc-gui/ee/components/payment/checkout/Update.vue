<script lang="ts" setup>
import dayjs from 'dayjs'
import { PlanLimitTypes, PlanOrder, PlanTitles } from 'nocodb-sdk'

const props = defineProps<{
  plan: PaymentPlan
}>()

const { navigateToPricing } = useEeConfig()

const {
  activeWorkspace,
  activePlan,
  activeSubscription,
  paymentMode,
  annualDiscount,
  onPaymentModeChange,
  workspaceSeatCount,
  getPlanPrice,
  updateSubscription,
  cancelSubscription,
} = usePaymentStoreOrThrow()

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
      ...(workspaceSeatCount.value > 3
        ? [
            {
              title: 'Number of editors',
              oldValue: `${workspaceSeatCount.value}`,
              newValue: '3',

              percent: (((workspaceSeatCount.value - 3) / workspaceSeatCount.value) * 100).toFixed(2),
            },
          ]
        : []),
      {
        title: 'Storage',
        oldValue: `${Number(
          (activePlan.value?.meta[PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE] ?? 0) / 1000,
        ).toLocaleString()} GB`,
        newValue: '1 GB',
        percent: (
          (((activePlan.value?.meta[PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE] ?? 0) / 1000 - 1) /
            ((activePlan.value?.meta[PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE] ?? 0) / 1000)) *
          100
        ).toFixed(2),
      },
      {
        title: 'API',
        oldValue: `${Number(activePlan.value?.meta[PlanLimitTypes.LIMIT_API_CALL] ?? 0).toLocaleString()} requests`,
        newValue: '1,000 requests',
        percent: (
          (((activePlan.value?.meta[PlanLimitTypes.LIMIT_API_CALL] ?? 0) - 1000) /
            (activePlan.value?.meta[PlanLimitTypes.LIMIT_API_CALL] ?? 0)) *
          100
        ).toFixed(2),
      },
      {
        title: 'Automation',
        oldValue: `${Number(activePlan.value?.meta[PlanLimitTypes.LIMIT_AUTOMATION_RUN] ?? 0)
          .toFixed(1)
          .toLocaleString()} runs`,
        newValue: '100 runs',
        percent: (
          (((activePlan.value?.meta[PlanLimitTypes.LIMIT_AUTOMATION_RUN] ?? 0) - 1000) /
            (activePlan.value?.meta[PlanLimitTypes.LIMIT_AUTOMATION_RUN] ?? 0)) *
          100
        ).toFixed(2),
      },
    ]
  } else {
    changes.change = PlanOrder[activePlan.value?.title as PlanTitles] <= PlanOrder[props.plan.title] ? 'upgrade' : 'downgrade'
  }

  return changes
})

const priceInfo = computed(() => {
  const p = getPlanPrice(props.plan)

  let total = p * workspaceSeatCount.value

  const pMonthly = getPlanPrice(props.plan, 'month')

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
  if (!changes.value.plan && !changes.value.period) {
    navigateToPricing()
    return
  }

  isLoading.value = true

  try {
    await updateSubscription(props.plan.id, undefined, changes.value.change === 'upgrade')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}

const onCancelSubscription = async () => {
  isLoading.value = true

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
  <div class="h-full flex flex-col max-w-[676px] mx-auto px-6">
    <div
      v-if="changes.change === 'upgrade'"
      class="py-2 w-full flex items-center justify-between gap-3 border-b-1 border-nc-border-gray-medium"
    >
      <div
        v-if="changes.plan || !changes.period || changes.period === 'year'"
        class="flex-1 text-xl text-nc-content-gray-emphasis font-700"
      >
        Upgrade Plan
      </div>
      <div v-else-if="changes.period" class="flex-1 text-xl text-nc-content-gray-emphasis font-700">Change Billing Period</div>
    </div>
    <div
      v-else-if="changes.change === 'downgrade'"
      class="py-2 w-full flex items-center justify-between gap-3 border-b-1 border-nc-border-gray-medium"
    >
      <div class="flex-1 text-xl text-nc-content-gray-emphasis font-700">Downgrade Plan</div>
    </div>
    <div
      v-else-if="changes.change === 'cancel'"
      class="py-2 w-full flex items-center justify-between gap-3 border-b-1 border-nc-border-gray-medium"
    >
      <div class="flex-1 text-xl text-nc-content-gray-emphasis font-700">Downgrade to Free Plan</div>
    </div>
    <div
      v-if="changes.change === 'upgrade' && (changes.plan || !changes.period || changes.period === 'year')"
      class="flex-1 nc-scrollbar-thin"
    >
      <div class="py-6 flex gap-6 flex-col">
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
                <span class="relative"> <span class="font-bold">Billable users:</span> {{ workspaceSeatCount }}</span>
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
                <span class="relative"> <span class="font-bold">Billable users:</span> {{ workspaceSeatCount }}</span>
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
        <div class="flex flex-col gap-4 text-nc-content-gray-subtle2">
          <div class="font-bold">Before you cancel your plan</div>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="decrease of changes.decrease"
              :key="decrease.title"
              class="bg-nc-bg-red-light rounded-lg p-4 border-1 border-red-500"
            >
              <div class="flex flex-col gap-2 items-center justify-center w-full font-bold">
                <span class="flex items-center gap-2 text-red-500 text-2xl">
                  <span class="text-2xl">-{{ decrease.percent }}%</span>
                  <GeneralIcon icon="ncArrowDownCircle" class="h-6 w-6 text-red-500" />
                </span>
                <span class="w-full">{{ decrease.oldValue }} -> {{ decrease.newValue }}</span>
                <span class="w-full">{{ decrease.title }}</span>
              </div>
            </div>
          </div>
          <div class="font-bold">You will no longer have access to following features:</div>
          <div class="flex flex-wrap gap-4">
            <div class="flex items-center gap-2 font-bold">
              <div class="flex items-center justify-center p-2 bg-nc-bg-maroon-light rounded-lg">
                <GeneralIcon icon="calendar" />
              </div>
              <span>Calendar View</span>
            </div>
            <div class="flex items-center gap-2 font-bold">
              <div class="flex items-center justify-center p-2 bg-nc-bg-purple-light rounded-lg">
                <GeneralIcon icon="form" />
              </div>
              <span>Form Branding</span>
            </div>
            <div class="flex items-center gap-2 font-bold">
              <div class="flex items-center justify-center p-2 bg-nc-bg-gray-light rounded-lg">
                <GeneralIcon icon="sso" />
              </div>
              <span>Single Sign-On (SSO)</span>
            </div>
            <div class="flex items-center gap-2 font-bold">
              <div class="flex items-center justify-center p-2 bg-nc-bg-purple-light rounded-lg">
                <GeneralIcon icon="ncPuzzleOutline" class="!stroke-transparent" />
              </div>
              <span>Extensions</span>
            </div>
          </div>
          <div>
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
      <NcButton class="w-1/2" type="secondary" @click="navigateToPricing()"> Cancel </NcButton>
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
      <NcButton class="w-1/2" type="secondary" @click="navigateToPricing()"> Cancel </NcButton>
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
