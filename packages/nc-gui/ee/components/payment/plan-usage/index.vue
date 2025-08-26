<script lang="ts" setup>
import { PlanLimitTypes, PlanMeta, PlanTitles } from 'nocodb-sdk'
import dayjs from 'dayjs'

const { $e } = useNuxtApp()

const { t } = useI18n()

const route = useRoute()

const workspaceStore = useWorkspace()

const { workspacesList, activeWorkspace: _activeWorkspace } = storeToRefs(workspaceStore)

const workspaceId = computed(() => route.params.workspaceId)

const activeWorkspace = computed(() =>
  workspaceId.value ? workspacesList.value.find((w) => w.id === workspaceId.value)! : _activeWorkspace.value!,
)

const { paymentState, workspaceOrOrgSeatCount, activeSubscription, onManageSubscription, plansAvailable, updateSubscription } =
  usePaymentStoreOrThrow()

const {
  getLimit,
  getStatLimit,
  activePlanTitle,
  navigateToPricing,
  isLoyaltyDiscountAvailable,
  gracePeriodEndDate,
  isUnderLoyaltyCutoffDate,
} = useEeConfig()

const loyalGracePeriod = computed(
  () =>
    isUnderLoyaltyCutoffDate.value &&
    activeWorkspace.value?.loyal &&
    activeWorkspace.value?.payment?.plan.title === PlanTitles.FREE,
)

const paymentInitiated = computed(() => paymentState.value === PaymentState.PAYMENT)

const activePlanMeta = computed(() => PlanMeta[activePlanTitle.value])

const scheduledChangeInfo = computed(() => {
  if (!activeSubscription.value || !activeSubscription.value.schedule_phase_start) return null

  // If only plan change is scheduled this will be internal change (loyalty > normal)
  if (
    activeSubscription.value.fk_plan_id === activeSubscription.value.schedule_fk_plan_id &&
    activeSubscription.value.period === activeSubscription.value.schedule_period
  )
    return null

  const scheduledChangeDate = dayjs(activeSubscription.value.schedule_phase_start)

  const scheduledPlanPeriod = activeSubscription.value.schedule_period

  const scheduledPlanId = activeSubscription.value.schedule_fk_plan_id

  const scheduledPlan = plansAvailable.value.find((plan) => plan.id === scheduledPlanId)

  return {
    date: `${scheduledChangeDate.format('DD MMMM YYYY')}`,
    plan: scheduledPlan,
    period: scheduledPlanPeriod,
  }
})

const nextInvoiceInfo = computed(() => {
  if (!activeSubscription.value) return null
  const nextInvoiceDate = dayjs(activeSubscription.value.upcoming_invoice_at)
  return {
    date: `${nextInvoiceDate.format('DD MMMM YYYY')}`,
    amount: new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: activeSubscription.value.upcoming_invoice_currency || 'USD',
    }).format(activeSubscription.value.upcoming_invoice_amount / 100),
  }
})

const currentPlanTitle = computed(() => {
  return activeWorkspace.value?.payment?.plan.title ?? PlanTitles.FREE
})

const showWarningStatusForSeatCount = computed(() => {
  return currentPlanTitle.value === PlanTitles.FREE && workspaceOrOrgSeatCount.value >= getLimit(PlanLimitTypes.LIMIT_EDITOR) - 1
})

const formatTotalLimit = (value: number) => {
  return isFinite(value) ? Number(value).toLocaleString() : 'Unlimited'
}

const getTooltipPrefix = (value: number, total: number) => {
  return value > total ? t('tooltip.exceedingLimit') : t('tooltip.approachingLimit')
}

const recordInfo = computed(() => {
  const value = getStatLimit(PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE)
  const total = loyalGracePeriod.value ? 1000 : getLimit(PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE) ?? 1000
  const showWarningStatus = (value / total) * 100 > 80

  return {
    value: Number(value).toLocaleString(),
    total: formatTotalLimit(total),
    showWarningStatus,
    tooltip: t('upgrade.recordLimitExceedTooltip', {
      prefix: getTooltipPrefix(value, total),
      activePlan: activePlanTitle.value,
      limit: total,
    }),
    isLimitReached: value >= total,
    isLimitExceeded: value > total,
  }
})

const storageInfo = computed(() => {
  const value = getStatLimit(PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE) / 1000
  const total = loyalGracePeriod.value ? 1 : getLimit(PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE) / 1000
  const showWarningStatus = (value / total) * 100 > 80

  return {
    value: Number(value).toFixed(1).toLocaleString(),
    total: formatTotalLimit(total),
    showWarningStatus,
    tooltip: t('upgrade.storageLimitExceedTooltip', {
      prefix: getTooltipPrefix(value, total),
      activePlan: activePlanTitle.value,
      limit: total,
    }),
    isLimitReached: value >= total,
    isLimitExceeded: value > total,
  }
})

const automationInfo = computed(() => {
  const value = getStatLimit(PlanLimitTypes.LIMIT_AUTOMATION_RUN)
  const total = loyalGracePeriod.value ? 100 : getLimit(PlanLimitTypes.LIMIT_AUTOMATION_RUN)
  const showWarningStatus = (value / total) * 100 > 80

  return {
    value: Number(value).toLocaleString(),
    total: formatTotalLimit(total),
    showWarningStatus,
    tooltip: t('upgrade.webhookLimitExceedTooltip', {
      prefix: getTooltipPrefix(value, total),
      activePlan: activePlanTitle.value,
      limit: total,
    }),
    isLimitReached: value >= total,
    isLimitExceeded: value > total,
  }
})

const apiCallsInfo = computed(() => {
  const value = getStatLimit(PlanLimitTypes.LIMIT_API_CALL)
  const total = loyalGracePeriod.value ? 1000 : getLimit(PlanLimitTypes.LIMIT_API_CALL)
  const showWarningStatus = (value / total) * 100 > 80

  return {
    value: Number(value).toLocaleString(),
    total: formatTotalLimit(total),
    showWarningStatus,
    tooltip: t('upgrade.apiLimitExceedTooltip', {
      prefix: getTooltipPrefix(value, total),
      activePlan: activePlanTitle.value,
      limit: total,
    }),
    isLimitReached: value >= total,
    isLimitExceeded: value > total,
  }
})

const isAnyPlanLimitReached = computed(() => {
  return (
    recordInfo.value.isLimitReached ||
    storageInfo.value.isLimitReached ||
    automationInfo.value.isLimitReached ||
    apiCallsInfo.value.isLimitReached
  )
})

const confirmOpen = ref(false)

const onUpdateSubscription = async (planId: string, stripePriceId: string, type: 'revert' | 'reactivate', newPlan?: string) => {
  confirmOpen.value = true

  const { close } = useDialog(resolveComponent('NcModalConfirm'), {
    'visible': confirmOpen,
    'title': 'Cancel Scheduled Plan Change',
    'content': `You’re about to cancel the scheduled plan change and keep your current plan. Would you like to continue?`,
    'okText': 'Confirm',
    'onCancel': closeDialog,
    'onOk': async () => {
      await updateSubscription(planId, stripePriceId)

      $e(`a:payment:billing:${type === 'revert' ? 'revert-scheduled-plan-change' : 'reactivate-plan'}`, {
        newPlan: newPlan ?? activePlanTitle.value,
      })

      window.location.reload()
    },
    'update:visible': closeDialog,
    'showIcon': false,
    'focusBtn': 'ok',
    'keyboard': true,
    'maskClosable': true,
    'okClass': '!outline-none',
  })

  function closeDialog() {
    confirmOpen.value = false
    close(1000)
  }
}
</script>

<template>
  <div v-if="!paymentInitiated" class="nc-plan-usage flex flex-col gap-6">
    <div class="flex flex-col gap-3 empty:hidden">
      <slot name="header"> </slot>
      <NcAlert v-if="scheduledChangeInfo" type="info" message="Your plan will switch after the current billing cycle ends.">
        <template #description>
          You've switched from the
          {{ activePlanTitle }} ({{ activeSubscription?.period === 'year' ? 'Annual' : 'Monthly' }}) to the
          {{ scheduledChangeInfo?.plan?.title }} ({{ scheduledChangeInfo?.period === 'year' ? 'Annual' : 'Monthly' }}). This
          change will take effect on {{ scheduledChangeInfo?.date }}.
        </template>
        <template #action>
          <NcButton
            v-e="[
              'c:payment:billing:revert-scheduled-plan-change',
              { activePlan: activePlanTitle, newPlan: scheduledChangeInfo?.plan?.title },
            ]"
            type="link"
            size="small"
            class="!p-0 mt-[-4px]"
            @click="
              onUpdateSubscription(
                activeSubscription.fk_plan_id,
                activeSubscription.stripe_price_id,
                'revert',
                scheduledChangeInfo?.plan?.title,
              )
            "
          >
            Revert
          </NcButton>
        </template>
      </NcAlert>
      <NcAlert v-else-if="activeSubscription?.canceled_at" type="warning" class="-mt-4">
        <template #message> Your {{ activePlanTitle }} plan will expire soon </template>
        <template #description>
          On {{ dayjs(activeSubscription.canceled_at).format('DD MMMM YYYY') }}, you’ll lose access to all
          {{ activePlanTitle }} features.
        </template>
        <template #action>
          <NcButton
            v-e="[
              'c:payment:billing:reactivate-plan',
              {
                activePlan: activePlanTitle,
              },
            ]"
            type="link"
            size="small"
            class="!p-0 mt-[-4px]"
            @click="
              onUpdateSubscription(
                activeSubscription.fk_plan_id,
                activeSubscription.stripe_price_id,
                'reactivate',
                activePlanTitle,
              )
            "
          >
            Reactivate {{ activePlanTitle }} Plan
          </NcButton>
        </template>
      </NcAlert>
    </div>

    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between gap-4 min-h-8">
        <div class="flex gap-2 items-center text-base font-weight-700 text-nc-content-gray !leading-7">
          <span>{{ $t('title.currentPlan') }}:</span>
          <span :style="{ color: activePlanMeta?.primary }">
            {{ $t(`objects.paymentPlan.${activeWorkspace?.payment?.plan.title ?? PlanTitles.FREE}`) }}
          </span>
          <NcBadge
            v-if="activeSubscription?.period"
            :border="false"
            class="text-nc-content-gray-subtle2 !bg-nc-bg-gray-medium text-[10px] leading-[14px] !h-[18px] font-semibold"
          >
            {{ activeSubscription?.period === 'year' ? 'Annual' : 'Monthly' }}
          </NcBadge>
        </div>
        <div class="flex gap-2">
          <NcButton v-if="activeSubscription" type="link" size="small" class="!hover:underline" @click="onManageSubscription">
            {{ $t('labels.manageSubscription') }}
          </NcButton>
          <NcButton
            v-if="!isAnyPlanLimitReached"
            v-e="['c:payment:billing:upgrade', { activePlan: activePlanTitle }]"
            type="primary"
            size="small"
            inner-class="!gap-1"
            @click="navigateToPricing({ triggerEvent: false })"
          >
            <template #icon>
              <GeneralIcon icon="ncArrowUpRight" />
            </template>
            Upgrade Workspace
          </NcButton>
        </div>
      </div>

      <NcAlert
        v-if="isAnyPlanLimitReached"
        type="warning"
        message="Plan Limit Reached"
        description="Please upgrade to continue using the service without interruptions."
        align="center"
        class="nc-plan-usage-plan-limit-reached-banner bg-nc-bg-orange-light !rounded-xl"
        :class="{
          'nc-loyalty-workspace': isLoyaltyDiscountAvailable,
        }"
      >
        <template #icon>
          <GeneralIcon icon="alertTriangleSolid" class="flex-none h-6 w-6 text-nc-content-orange-medium"></GeneralIcon>
        </template>
        <template #action>
          <div v-if="recordInfo.isLimitReached || storageInfo.isLimitReached" class="flex items-center justify-center">
            <PaymentExpiresIn
              v-if="gracePeriodEndDate"
              :end-time="gracePeriodEndDate"
              hide-icon
              hide-label
              class="!bg-transparent text-nc-content-gray-subtle children:font-500 text-center px-0 underline decoration-dotted"
            />
          </div>
          <NcButton
            v-e="['c:payment:billing:upgrade', { activePlan: activePlanTitle }]"
            type="primary"
            size="small"
            inner-class="!gap-1"
            @click="navigateToPricing({ triggerEvent: false })"
          >
            <template #icon>
              <GeneralIcon icon="ncArrowUpRight" />
            </template>
            Upgrade Workspace
          </NcButton>
        </template>
      </NcAlert>

      <div
        class="nc-current-plan-table rounded-lg border-1"
        :style="{
          borderColor: activePlanMeta?.border,
          background: activePlanMeta?.bgLight,
          color: activePlanMeta?.primary,
        }"
      >
        <PaymentPlanUsageRow v-if="currentPlanTitle !== PlanTitles.FREE" :plan-meta="activePlanMeta">
          <template #label> {{ $t('objects.currentPlan.nextInvoice') }} </template>
          <template #value>
            <div v-if="!activeSubscription">-</div>
            <div v-else-if="activeSubscription?.canceled_at" class="text-nc-content-red-medium">
              Marked for cancellation, due {{ new Date(activeSubscription.canceled_at).toLocaleDateString() }}
            </div>
            <div v-else>{{ nextInvoiceInfo?.amount }}, {{ nextInvoiceInfo?.date }}</div>
          </template>
        </PaymentPlanUsageRow>
        <PaymentPlanUsageRow
          :plan-meta="activePlanMeta"
          :show-warning-status="showWarningStatusForSeatCount"
          :tooltip="
            $t('upgrade.editorLimitExceedTooltip', {
              prefix: getTooltipPrefix(workspaceOrOrgSeatCount, getLimit(PlanLimitTypes.LIMIT_EDITOR)),
              activePlan: activePlanTitle,
              limit: getLimit(PlanLimitTypes.LIMIT_EDITOR),
            })
          "
          :is-limit-exceeded="workspaceOrOrgSeatCount > getLimit(PlanLimitTypes.LIMIT_EDITOR)"
        >
          <template #label>
            {{
              currentPlanTitle === PlanTitles.FREE
                ? $t('objects.currentPlan.numberOfBillableUsers')
                : $t('objects.currentPlan.numberOfBilledUsers')
            }}
          </template>
          <template #value
            >{{ workspaceOrOrgSeatCount }} {{ currentPlanTitle === PlanTitles.FREE ? 'Billable' : 'Paid' }}
            {{ workspaceOrOrgSeatCount === 1 ? 'User' : 'Users' }}</template
          >
        </PaymentPlanUsageRow>
        <PaymentPlanUsageRow
          :plan-meta="activePlanMeta"
          :show-warning-status="recordInfo.showWarningStatus"
          :tooltip="recordInfo.tooltip"
          :is-limit-exceeded="recordInfo.isLimitExceeded"
        >
          <template #label>
            <span class="capitalize">
              {{ $t('objects.records') }}
            </span>
          </template>
          <template #value> {{ recordInfo.value }} of {{ recordInfo.total }} records</template>
        </PaymentPlanUsageRow>
        <PaymentPlanUsageRow
          :plan-meta="activePlanMeta"
          :show-warning-status="storageInfo.showWarningStatus"
          :tooltip="storageInfo.tooltip"
          :is-limit-exceeded="storageInfo.isLimitExceeded"
        >
          <template #label> {{ $t('objects.currentPlan.storageUsedGB') }} </template>
          <template #value> {{ storageInfo.value }} GB of {{ storageInfo.total }} GB attachments </template>
        </PaymentPlanUsageRow>
        <PaymentPlanUsageRow
          :plan-meta="activePlanMeta"
          :show-warning-status="automationInfo.showWarningStatus"
          :tooltip="automationInfo.tooltip"
          :is-limit-exceeded="automationInfo.isLimitExceeded"
        >
          <template #label> {{ $t('objects.currentPlan.webhookCallsMonthly') }} </template>
          <template #value> {{ automationInfo.value }} of {{ automationInfo.total }} webhook calls per month </template>
        </PaymentPlanUsageRow>
        <PaymentPlanUsageRow
          :plan-meta="activePlanMeta"
          :show-warning-status="apiCallsInfo.showWarningStatus"
          :tooltip="apiCallsInfo.tooltip"
          :is-limit-exceeded="apiCallsInfo.isLimitExceeded"
        >
          <template #label> {{ $t('objects.currentPlan.apiCallsMonthly') }} </template>
          <template #value> {{ apiCallsInfo.value }} of {{ apiCallsInfo.total }} API calls per month </template>
        </PaymentPlanUsageRow>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-current-plan-table {
  @apply border-nc-border-gray-medium overflow-hidden;
}
</style>

<style lang="scss">
// Hide top banner if user is not loyal user
.nc-payment-billing-page {
  &:has(.nc-plan-usage-plan-limit-reached-banner:not(.nc-loyalty-workspace)) {
    .nc-payment-banner-wrapper {
      @apply hidden;
    }
  }
}
</style>
