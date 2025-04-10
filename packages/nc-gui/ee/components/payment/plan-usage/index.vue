<script lang="ts" setup>
import { PlanLimitTypes, PlanMeta, PlanTitles } from 'nocodb-sdk'
import dayjs from 'dayjs'

const route = useRoute()

const workspaceStore = useWorkspace()

const { workspacesList, activeWorkspace: _activeWorkspace } = storeToRefs(workspaceStore)

const workspaceId = computed(() => route.params.workspaceId)

const activeWorkspace = computed(() =>
  workspaceId.value ? workspacesList.value.find((w) => w.id === workspaceId.value)! : _activeWorkspace.value!,
)

const { paymentState, workspaceSeatCount, activeSubscription, onManageSubscription, plansAvailable, updateSubscription } =
  useProvidePaymentStore()

const { getLimit, getStatLimit } = useEeConfig()

const paymentInitiated = computed(() => paymentState.value === PaymentState.PAYMENT)

const activePlanMeta = computed(() => PlanMeta[(activeWorkspace.value?.payment?.plan.title ?? PlanTitles.FREE) as PlanTitles])

const scheduledChangeInfo = computed(() => {
  if (!activeSubscription.value || !activeSubscription.value.scheduled_plan_start_at) return null

  const scheduledChangeDate = dayjs(activeSubscription.value.scheduled_plan_start_at)

  const scheduledPlanPeriod = activeSubscription.value.scheduled_plan_period

  const scheduledPlanId = activeSubscription.value.scheduled_fk_plan_id

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
  return currentPlanTitle.value === PlanTitles.FREE && workspaceSeatCount.value >= getLimit(PlanLimitTypes.LIMIT_EDITOR) - 1
})

const recordInfo = computed(() => {
  const value = getStatLimit(PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE)
  const total = getLimit(PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE) ?? 1000
  const showWarningStatus = (value / total) * 100 > 80

  console.log('total', total)

  return {
    value: Number(value).toLocaleString(),
    total: Number(total).toLocaleString(),
    showWarningStatus: showWarningStatus,
  }
})

const storageInfo = computed(() => {
  const value = getStatLimit(PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE) / 1000
  const total = getLimit(PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE) / 1000
  const showWarningStatus = (value / total) * 100 > 80

  return {
    value: Number(value).toFixed(1).toLocaleString(),
    total: Number(total).toLocaleString(),
    showWarningStatus: showWarningStatus,
  }
})

const automationInfo = computed(() => {
  const value = getStatLimit(PlanLimitTypes.LIMIT_AUTOMATION_RUN)
  const total = getLimit(PlanLimitTypes.LIMIT_AUTOMATION_RUN)
  const showWarningStatus = (value / total) * 100 > 80

  return {
    value: Number(value).toLocaleString(),
    total: Number(total).toLocaleString(),
    showWarningStatus: showWarningStatus,
  }
})

const apiCallsInfo = computed(() => {
  const value = getStatLimit(PlanLimitTypes.LIMIT_API_CALL)
  const total = getLimit(PlanLimitTypes.LIMIT_API_CALL)
  const showWarningStatus = (value / total) * 100 > 80

  return {
    value: Number(value).toLocaleString(),
    total: Number(total).toLocaleString(),
    showWarningStatus: showWarningStatus,
  }
})
</script>

<template>
  <div v-if="!paymentInitiated" class="flex flex-col gap-3">
    <div class="flex items-center justify-between gap-4 min-h-8">
      <div class="text-base font-weight-700 text-nc-content-gray !leading-7">
        {{ $t('title.currentPlan') }}:
        <span class="text-xl" :style="{ color: activePlanMeta?.primary }">
          {{ $t(`objects.paymentPlan.${activeWorkspace?.payment?.plan.title ?? PlanTitles.FREE}`) }}
        </span>
      </div>
      <NcButton
        v-if="activeSubscription"
        type="secondary"
        size="small"
        icon-position="right"
        inner-class="!gap-2"
        class="!text-nc-content-brand"
        @click="onManageSubscription"
      >
        <template #icon>
          <GeneralIcon icon="ncArrowUpRight" />
        </template>
        {{ $t('labels.manageSubscription') }}
      </NcButton>
    </div>

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
          <div v-else-if="activeSubscription?.canceled_at" class="text-red-500">
            Marked for cancellation, due {{ new Date(activeSubscription.canceled_at).toLocaleDateString() }}
          </div>
          <div v-else>{{ nextInvoiceInfo?.amount }}, {{ nextInvoiceInfo?.date }}</div>
          <div v-if="scheduledChangeInfo">
            <div class="text-xs text-nc-content-gray-muted leading-[18px]">
              Next billing cycle:
              <span class="font-semibold">
                {{ scheduledChangeInfo?.plan?.title }} ({{ scheduledChangeInfo?.period === 'year' ? 'Annually' : 'Monthly' }})
              </span>
              <!-- Cancel -->
              <span
                class="text-red-500"
                @click="updateSubscription(activeSubscription.fk_plan_id, activeSubscription.stripe_price_id)"
                >(Cancel)</span
              >
            </div>
          </div>
        </template>
      </PaymentPlanUsageRow>
      <PaymentPlanUsageRow :plan-meta="activePlanMeta" :show-warning-status="showWarningStatusForSeatCount">
        <template #label>
          {{
            currentPlanTitle === PlanTitles.FREE
              ? $t('objects.currentPlan.numberOfBillableUsers')
              : $t('objects.currentPlan.numberOfBilledUsers')
          }}
        </template>
        <template #value>{{ workspaceSeatCount }} </template>
      </PaymentPlanUsageRow>
      <PaymentPlanUsageRow :plan-meta="activePlanMeta" :show-warning-status="recordInfo.showWarningStatus">
        <template #label>
          <span class="capitalize">
            {{ $t('objects.records') }}
          </span>
        </template>
        <template #value> {{ recordInfo.value }}/{{ recordInfo.total }} </template>
      </PaymentPlanUsageRow>
      <PaymentPlanUsageRow :plan-meta="activePlanMeta" :show-warning-status="storageInfo.showWarningStatus">
        <template #label> {{ $t('objects.currentPlan.storageUsedGB') }} </template>
        <template #value> {{ storageInfo.value }}/{{ storageInfo.total }} </template>
      </PaymentPlanUsageRow>
      <PaymentPlanUsageRow :plan-meta="activePlanMeta" :show-warning-status="automationInfo.showWarningStatus">
        <template #label> {{ $t('objects.currentPlan.webhookCallsMonthly') }} </template>
        <template #value> {{ automationInfo.value }}/{{ automationInfo.total }} </template>
      </PaymentPlanUsageRow>
      <PaymentPlanUsageRow :plan-meta="activePlanMeta" :show-warning-status="apiCallsInfo.showWarningStatus">
        <template #label> {{ $t('objects.currentPlan.apiCallsMonthly') }} </template>
        <template #value> {{ apiCallsInfo.value }}/{{ apiCallsInfo.total }} </template>
      </PaymentPlanUsageRow>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-current-plan-table {
  @apply border-nc-border-gray-medium overflow-hidden;
}
</style>
