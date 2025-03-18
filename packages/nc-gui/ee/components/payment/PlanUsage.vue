<script lang="ts" setup>
const route = useRoute()

const workspaceStore = useWorkspace()

const { workspacesList } = storeToRefs(workspaceStore)

const workspaceId = computed(() => route.params.workspaceId)

const activeWorkspace = computed(() => workspacesList.value.find((w) => w.id === workspaceId.value)!)

const { paymentState } = useProvidePaymentStore()

const paymentInitiated = computed(() => paymentState.value === PaymentState.PAYMENT)
</script>

<template>
  <div
    v-if="!paymentInitiated"
    class="flex flex-col min-w-[fit-content] rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-gray-extralight p-6 gap-4"
  >
    <div class="text-2xl font-bold">{{ activeWorkspace?.payment?.plan.title }}</div>
    <div class="flex items-center border-1 border-nc-border-gray-medium rounded-lg w-[fit-content]">
      <div class="w-[300px] flex flex-col p-4 gap-2 border-r-1">
        <div class="flex items-center gap-2 text-nc-content-gray text-2xl font-bold">
          {{ activeWorkspace?.stats?.row_count ?? 0 }} <span class="text-base">of</span>
          <span class="text-base">{{ activeWorkspace?.payment?.plan.meta.limit_workspace_row }}</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex-1 h-2 bg-nc-border-gray-medium rounded-lg">
            <div
              class="h-full bg-brand-500 rounded-lg"
              :style="{
                width: `${
                  ((activeWorkspace?.stats?.row_count ?? 0) / (activeWorkspace?.payment?.plan.meta.limit_workspace_row ?? 1)) *
                  100
                }%`,
              }"
            ></div>
          </div>
        </div>
        <div class="flex items-center text-nc-content-gray-subtle2 text-sm">Records</div>
      </div>
      <div class="w-[300px] flex flex-col p-4 gap-2">
        <div class="flex items-center gap-2 text-nc-content-gray text-2xl font-bold">
          {{ (activeWorkspace?.stats?.storage ?? 0) / 1024 }} <span class="text-base">of</span>
          <span class="text-base">{{ activeWorkspace?.payment?.plan.meta.limit_storage / 1024 }}GB</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex-1 h-2 bg-nc-border-gray-medium rounded-lg">
            <div
              class="h-full bg-brand-500 rounded-lg"
              :style="{
                width: `${
                  ((activeWorkspace?.stats?.storage ?? 0) /
                    1024 /
                    ((activeWorkspace?.payment?.plan.meta.limit_storage ?? 1) / 1024)) *
                  100
                }%`,
              }"
            ></div>
          </div>
        </div>
        <div class="flex items-center text-nc-content-gray-subtle2 text-sm">Storage</div>
      </div>
    </div>
  </div>
</template>
