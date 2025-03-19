<script lang="ts" setup>
import { PlanMeta, PlanTitles } from 'nocodb-sdk'

const route = useRoute()

const workspaceStore = useWorkspace()

const { workspacesList } = storeToRefs(workspaceStore)

const workspaceId = computed(() => route.params.workspaceId)

const activeWorkspace = computed(() => workspacesList.value.find((w) => w.id === workspaceId.value)!)

const { paymentState, workspaceSeatCount } = useProvidePaymentStore()

const paymentInitiated = computed(() => paymentState.value === PaymentState.PAYMENT)

const activePlanMeta = computed(
  () => PlanMeta[(activeWorkspace.value?.payment?.plan.title ?? PlanTitles.FREE) as keyof typeof PlanMeta],
)
</script>

<template>
  <div
    v-if="!paymentInitiated"
    class="flex flex-col min-w-[fit-content] rounded-[20px] border-1 p-6 gap-4"
    :style="{ backgroundColor: activePlanMeta.color, borderColor: activePlanMeta.accent }"
  >
    <div class="text-2xl font-bold">{{ activeWorkspace?.payment?.plan.title }}</div>
    <div
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
