<script lang="ts" setup>
import { PlanMeta, PlanTitles } from 'nocodb-sdk'

const route = useRoute()

const workspaceStore = useWorkspace()

const { workspacesList, activeWorkspace: _activeWorkspace } = storeToRefs(workspaceStore)

const workspaceId = computed(() => route.params.workspaceId)

const activeWorkspace = computed(() =>
  workspaceId.value ? workspacesList.value.find((w) => w.id === workspaceId.value)! : _activeWorkspace.value!,
)

const { paymentState, workspaceSeatCount } = useProvidePaymentStore()

const paymentInitiated = computed(() => paymentState.value === PaymentState.PAYMENT)

const activePlanMeta = computed(() =>
  activeWorkspace.value?.payment?.plan.title === 'Plus'
    ? PlanMeta[PlanTitles.BUSINESS]
    : PlanMeta[(activeWorkspace.value?.payment?.plan.title ?? PlanTitles.FREE) as PlanTitles],
)

const chartFillColor = computed(() => {
  return activePlanMeta.value.chartFillColor ?? activePlanMeta.value.primary
})

const isTableMode = ref(1)

const toggleDesign = () => {
  if (isTableMode.value < 3) {
    isTableMode.value += isTableMode.value
  } else {
    isTableMode.value = 1
  }
}
</script>

<template>
  <div
    v-if="!paymentInitiated"
    class="nc-current-plan-card flex flex-col min-w-[fit-content] rounded-[20px] border-1 p-6 gap-5 border-nc-border-gray-medium"
    :style="{ backgroundColor: activePlanMeta.color, color: activePlanMeta?.primary }"
  >
    <div class="flex items-center justify-between">
      <div class="text-2xl font-bold">
        {{ $t(`objects.paymentPlan.${activeWorkspace?.payment?.plan.title ?? PlanTitles.FREE}`) }}
      </div>
      <NcButton size="small" type="secondary" @click="toggleDesign"> Toggle design </NcButton>
    </div>

    <div
      v-if="isTableMode === 1"
      class="nc-current-plan-table rounded-lg border-1"
      :style="{
        borderColor: activePlanMeta?.border,
      }"
    >
      <PaymentPlanUsageRow :plan-meta="activePlanMeta">
        <template #label> {{ $t('objects.currentPlan.nextInvoice') }} </template>
        <template #value>
          <div class="w-6"></div>
          16 July 2025</template
        >
      </PaymentPlanUsageRow>
      <PaymentPlanUsageRow :plan-meta="activePlanMeta">
        <template #label> {{ $t('objects.currentPlan.nextInvoiceAmount') }} </template>
        <template #value>
          <div class="w-6"></div>
          60$ - 24 Jan 2025
        </template>
      </PaymentPlanUsageRow>
      <PaymentPlanUsageRow :plan-meta="activePlanMeta">
        <template #label> {{ $t('objects.currentPlan.numberOfBilledUsers') }} </template>
        <template #value>
          <div class="w-6"></div>
          4
        </template>
      </PaymentPlanUsageRow>
      <PaymentPlanUsageRow :plan-meta="activePlanMeta">
        <template #label> {{ $t('objects.currentPlan.storageUsedGB') }} </template>
        <template #value>
          <NcPieChart
            :value="3.93"
            :total="20"
            :size="24"
            :fill-color="chartFillColor"
            :background-color="activePlanMeta?.bgDark"
          />
          <span> 3.93/20 GB </span>
        </template>
      </PaymentPlanUsageRow>
      <PaymentPlanUsageRow :plan-meta="activePlanMeta">
        <template #label> {{ $t('objects.currentPlan.webhookCallsMonthly') }} </template>
        <template #value>
          <NcPieChart
            :value="4619"
            :total="15000"
            :size="24"
            :fill-color="chartFillColor"
            :background-color="activePlanMeta?.bgDark"
          />
          <span> 4619/150K </span>
        </template>
      </PaymentPlanUsageRow>
      <PaymentPlanUsageRow :plan-meta="activePlanMeta">
        <template #label> {{ $t('objects.currentPlan.apiCallsMonthly') }} </template>
        <template #value>
          <NcPieChart
            :value="12000"
            :total="15000"
            :size="24"
            :fill-color="chartFillColor"
            :background-color="activePlanMeta?.bgDark"
          />
          <span> 120K/150K </span>
        </template>
      </PaymentPlanUsageRow>
    </div>
    <div v-else-if="isTableMode === 2" class="flex flex-col gap-3">
      <div class="flex items-stretch gap-3">
        <PaymentPlanUsageRow variant="banner">
          <template #label> {{ $t('objects.currentPlan.nextInvoice') }} </template>
          <template #value> 16 July 2025</template>
        </PaymentPlanUsageRow>

        <PaymentPlanUsageRow variant="banner">
          <template #label> {{ $t('objects.currentPlan.nextInvoiceAmount') }} </template>
          <template #value> 60$ - 24 Jan 2025 </template>
        </PaymentPlanUsageRow>
      </div>
      <div class="flex items-stretch gap-3">
        <PaymentPlanUsageRow variant="banner">
          <template #label> {{ $t('objects.currentPlan.numberOfBilledUsers') }} </template>
          <template #value> 4</template>
        </PaymentPlanUsageRow>

        <PaymentPlanUsageRow variant="banner">
          <template #label> {{ $t('objects.currentPlan.storageUsedGB') }} </template>
          <template #value> 3.93/20 GB </template>
        </PaymentPlanUsageRow>
      </div>
      <div class="flex items-stretch gap-3">
        <PaymentPlanUsageRow variant="banner">
          <template #label> {{ $t('objects.currentPlan.webhookCallsMonthly') }} </template>
          <template #value> 4619/150K </template>
        </PaymentPlanUsageRow>

        <PaymentPlanUsageRow variant="banner">
          <template #label> {{ $t('objects.currentPlan.apiCallsMonthly') }} </template>
          <template #value> 120K/150K </template>
        </PaymentPlanUsageRow>
      </div>
    </div>
    <div
      v-else
      class="flex items-center border-1 border-nc-border-gray-medium rounded-lg w-[fit-content] divide-x divide-inherit"
      :style="{ borderColor: activePlanMeta.accent }"
    >
      <PaymentPlanUsageCard
        :used="+(workspaceSeatCount ?? 0)"
        :total="activeWorkspace?.payment?.plan.title === 'Free' ? 5 : Infinity"
        title="Seats"
        :plan-meta="activePlanMeta"
      />
      <PaymentPlanUsageCard
        :used="+(activeWorkspace?.stats?.row_count ?? 0)"
        :total="+(activeWorkspace?.payment?.plan.meta.limit_workspace_row ?? 0)"
        title="Records"
        :plan-meta="activePlanMeta"
      />
      <PaymentPlanUsageCard
        :used="+(activeWorkspace?.stats?.storage ?? 0) / 1024"
        :total="+(activeWorkspace?.payment?.plan.meta.limit_storage ?? 0) / 1024"
        title="Storage"
        unit="GB"
        :plan-meta="activePlanMeta"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-current-plan-card {
  @apply bg-nc-bg-gray-extralight;

  box-shadow: 0px 4px 8px -2px rgba(0, 0, 0, 0.08), 0px 2px 4px -2px rgba(0, 0, 0, 0.04);
}

.nc-current-plan-table {
  @apply border-nc-border-gray-medium overflow-hidden;
}
</style>
