<script lang="ts" setup>
import { PlanMeta, PlanTitles } from 'nocodb-sdk'
import dayjs from 'dayjs'

const route = useRoute()

const workspaceStore = useWorkspace()

const { workspacesList, activeWorkspace: _activeWorkspace } = storeToRefs(workspaceStore)

const workspaceId = computed(() => route.params.workspaceId)

const activeWorkspace = computed(() =>
  workspaceId.value ? workspacesList.value.find((w) => w.id === workspaceId.value)! : _activeWorkspace.value!,
)

const { paymentState, workspaceSeatCount, activeSubscription, onManageSubscription } = useProvidePaymentStore()

const paymentInitiated = computed(() => paymentState.value === PaymentState.PAYMENT)

const activePlanMeta = computed(() =>
  activeWorkspace.value?.payment?.plan.title === 'Plus'
    ? PlanMeta[PlanTitles.BUSINESS]
    : PlanMeta[(activeWorkspace.value?.payment?.plan.title ?? PlanTitles.FREE) as PlanTitles],
)

const nextInvoiceInfo = computed(() => {
  if (!activeSubscription.value) return null
  const nextInvoiceDate = dayjs(activeSubscription.value.next_invoice_date)
  return {
    date: `${nextInvoiceDate.format('DD MMMM YYYY')}`,
    amount: new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: activeSubscription.value.next_invoice_currency || 'USD',
    }).format(activeSubscription.value.next_invoice_amount / 100),
  }
})

const currentPlanTitle = computed(() => {
  return activeWorkspace.value?.payment?.plan.title ?? PlanTitles.FREE
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
      <NcButton v-if="activeSubscription" size="small" icon-position="right" inner-class="!gap-2" @click="onManageSubscription">
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
          <div v-else-if="activeSubscription?.end_at" class="text-red-500">
            Marked for cancellation, due {{ new Date(activeSubscription.end_at).toLocaleDateString() }}
          </div>
          <div v-else>{{ nextInvoiceInfo?.amount }}, {{ nextInvoiceInfo?.date }}</div></template
        >
      </PaymentPlanUsageRow>
      <PaymentPlanUsageRow :plan-meta="activePlanMeta">
        <template #label>
          {{
            currentPlanTitle === PlanTitles.FREE
              ? $t('objects.currentPlan.numberOfBillableUsers')
              : $t('objects.currentPlan.numberOfBilledUsers')
          }}
        </template>
        <template #value>{{ workspaceSeatCount }} </template>
      </PaymentPlanUsageRow>
      <PaymentPlanUsageRow :plan-meta="activePlanMeta">
        <template #label> {{ $t('objects.currentPlan.storageUsedGB') }} </template>
        <template #value> Coming Soon/20 GB </template>
      </PaymentPlanUsageRow>
      <PaymentPlanUsageRow :plan-meta="activePlanMeta">
        <template #label> {{ $t('objects.currentPlan.webhookCallsMonthly') }} </template>
        <template #value> Coming Soon/150,000 </template>
      </PaymentPlanUsageRow>
      <PaymentPlanUsageRow :plan-meta="activePlanMeta">
        <template #label> {{ $t('objects.currentPlan.apiCallsMonthly') }} </template>
        <template #value> Coming Soon/150,000 </template>
      </PaymentPlanUsageRow>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-current-plan-table {
  @apply border-nc-border-gray-medium overflow-hidden;
}
</style>
