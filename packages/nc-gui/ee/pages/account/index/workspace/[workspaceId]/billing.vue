<script lang="ts" setup>
import { PaymentState } from '#imports'

const route = useRoute()

const workspaceStore = useWorkspace()

const { workspacesList } = storeToRefs(workspaceStore)

const workspaceId = computed(() => route.params.workspaceId)

const activeWorkspace = computed(() => workspacesList.value.find((w) => w.id === workspaceId.value)!)

const { paymentState, loadPlans } = useProvidePaymentStore()

const paymentInitiated = computed(() => paymentState.value === PaymentState.PAYMENT)

onMounted(() => {
  workspaceStore.loadWorkspace(workspaceId.value).then(() => {
    loadPlans().then(() => {
      paymentState.value = PaymentState.SELECT_PLAN
    })
  })
})
</script>

<template>
  <div class="h-full">
    <div class="flex flex-col">
      <NcPageHeader>
        <template #icon>
          <GeneralIcon icon="ncDollarSign" class="flex-none text-gray-700 text-[20px] h-5 w-5" />
        </template>
        <template #title>
          <span data-rec="true"> Billing </span>
        </template>
      </NcPageHeader>
      <div class="nc-content-max-w p-6 h-[calc(100vh_-_100px)] flex flex-col gap-6 overflow-auto nc-scrollbar-thin">
        <div class="flex flex-col gap-6 w-300 mx-auto">
          <div v-if="!paymentInitiated" class="text-lg font-bold">Current Plan</div>
          <div
            v-if="!paymentInitiated"
            class="flex flex-col rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-gray-extralight p-6 gap-4"
          >
            <div class="text-2xl font-bold">{{ activeWorkspace?.payment?.plan.title }}</div>
            <div class="flex items-center border-1 border-nc-border-gray-medium rounded-lg w-[fit-content]">
              <div class="w-[300px] flex flex-col p-4 gap-2 border-r-1">
                <div class="flex items-center gap-2 text-nc-content-gray text-xl font-bold">
                  {{ activeWorkspace?.stats?.row_count ?? 0 }} of
                  {{ activeWorkspace?.payment?.plan.meta.limit_workspace_row }}
                </div>
                <div class="flex items-center gap-2">
                  <div class="flex-1 h-2 bg-nc-border-gray-medium rounded-lg">
                    <div
                      class="h-full bg-brand-500 rounded-lg"
                      :style="{
                        width: `${
                          ((activeWorkspace?.stats?.row_count ?? 0) /
                            (activeWorkspace?.payment?.plan.meta.limit_workspace_row ?? 1)) *
                          100
                        }%`,
                      }"
                    ></div>
                  </div>
                </div>
                <div class="flex items-center text-nc-content-gray-subtle2 text-sm">Number of records</div>
              </div>
              <div class="w-[300px] flex flex-col p-4 gap-2">
                <div class="flex items-center gap-2 text-nc-content-gray text-xl font-bold">
                  {{ (activeWorkspace?.stats?.storage ?? 0) / 1024 }} of
                  {{ activeWorkspace?.payment?.plan.meta.limit_storage / 1024 }}
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
                <div class="flex items-center text-nc-content-gray-subtle2 text-sm">Storage (GB)</div>
              </div>
            </div>
          </div>
          <Payment v-if="paymentState" />
          <GeneralLoader v-else />
        </div>
      </div>
    </div>
  </div>
</template>
