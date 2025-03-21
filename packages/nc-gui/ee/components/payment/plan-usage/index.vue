<script lang="ts" setup>
import { PlanMeta, PlanTitles } from 'nocodb-sdk'

const route = useRoute()

const workspaceStore = useWorkspace()

const { workspacesList } = storeToRefs(workspaceStore)

const workspaceId = computed(() => route.params.workspaceId)

const activeWorkspace = computed(() => workspacesList.value.find((w) => w.id === workspaceId.value)!)

const { paymentState, workspaceSeatCount } = useProvidePaymentStore()

const paymentInitiated = computed(() => paymentState.value === PaymentState.PAYMENT)

const activePlanMeta = computed(() => PlanMeta[(activeWorkspace.value?.payment?.plan.title ?? PlanTitles.FREE) as PlanTitles])

const enableOldUI = false
</script>

<template>
  <div
    v-if="!paymentInitiated"
    class="nc-current-plan-card flex flex-col min-w-[fit-content] rounded-[20px] border-1 p-6 gap-5"
    :style="{ backgroundColor: activePlanMeta.color, borderColor: activePlanMeta.accent }"
  >
    <div class="text-2xl font-bold">
      {{ $t(`objects.paymentPlan.${activeWorkspace?.payment?.plan.title ?? PlanTitles.FREE}`) }}
    </div>

    <div
      class="nc-current-plan-table rounded-lg border-1"
      :style="{
        borderColor: activePlanMeta?.border,
        color: activePlanMeta?.primary,
      }"
    >
      <PaymentPlanUsageRow :plan-meta="activePlanMeta">
        <template #label> {{ $t('objects.currentPlan.nextInvoice') }} </template>
        <template #value> 16 July 2025</template>
      </PaymentPlanUsageRow>
      <PaymentPlanUsageRow :plan-meta="activePlanMeta">
        <template #label> {{ $t('objects.currentPlan.nextInvoiceAmount') }} </template>
        <template #value> 60$ - 24 Jan 2025</template>
      </PaymentPlanUsageRow>
      <PaymentPlanUsageRow :plan-meta="activePlanMeta">
        <template #label> {{ $t('objects.currentPlan.numberOfBilledUsers') }} </template>
        <template #value> 4</template>
      </PaymentPlanUsageRow>
      <PaymentPlanUsageRow :plan-meta="activePlanMeta">
        <template #label> {{ $t('objects.currentPlan.storageUsedGB') }} </template>
        <template #value> 0.93/20 GB</template>
      </PaymentPlanUsageRow>
      <PaymentPlanUsageRow :plan-meta="activePlanMeta">
        <template #label> {{ $t('objects.currentPlan.webhookCallsMonthly') }} </template>
        <template #value> 619/150K</template>
      </PaymentPlanUsageRow>
      <PaymentPlanUsageRow :plan-meta="activePlanMeta">
        <template #label> {{ $t('objects.currentPlan.apiCallsMonthly') }} </template>
        <template #value> 120/150K</template>
      </PaymentPlanUsageRow>
    </div>
    <div
      v-if="enableOldUI"
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
}

.nc-current-plan-table {
  @apply border-nc-border-gray-medium overflow-hidden;

  :deep(.nc-current-plan-table-row) {
    @apply border-b last-of-type:border-b-0 border-inherit flex items-center children:w-1/2;

    .nc-current-plan-table-cell {
      @apply h-[54px] px-6 py-3 text-sm text-inherit flex items-center gap-2;

      &.nc-cell-label {
        @apply bg-nc-bg-gray-light font-weight-500;
      }

      &.nc-cell-value {
        @apply text-nc-content-gray font-semibold;
      }
    }
  }
}
</style>
