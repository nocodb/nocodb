<script lang="ts" setup>
const route = useRoute()

const workspaceStore = useWorkspace()

const { workspacesList } = storeToRefs(workspaceStore)

const workspaceId = computed(() => route.params.workspaceId)

const activeWorkspace = computed(() => workspacesList.value.find((w) => w.id === workspaceId.value)!)

const { paymentState, workspaceSeatCount } = useProvidePaymentStore()

const paymentInitiated = computed(() => paymentState.value === PaymentState.PAYMENT)
</script>

<template>
  <div
    v-if="!paymentInitiated"
    class="flex flex-col min-w-[fit-content] rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-gray-extralight p-6 gap-4"
  >
    <div class="text-2xl font-bold">{{ activeWorkspace?.payment?.plan.title }}</div>
    <div class="flex items-center border-1 border-nc-border-gray-medium rounded-lg w-[fit-content]">
      <PaymentPlanUsageCard
        :used="+(workspaceSeatCount ?? 0)"
        :total="activeWorkspace?.payment?.plan.title === 'Free' ? 5 : Infinity"
        title="Seats"
      />
      <PaymentPlanUsageCard
        :used="+(activeWorkspace?.stats?.row_count ?? 0)"
        :total="+(activeWorkspace?.payment?.plan.meta.limit_workspace_row ?? 0)"
        title="Records"
      />
      <PaymentPlanUsageCard
        :used="+(activeWorkspace?.stats?.storage?? 0)"
        :total="+(activeWorkspace?.payment?.plan.meta.limit_storage ?? 0)"
        title="Storage"
        unit="GB"
      />
    </div>
  </div>
</template>
