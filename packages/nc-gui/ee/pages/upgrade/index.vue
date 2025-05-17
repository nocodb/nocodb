<script lang="ts" setup>
import { PlanTitles, WorkspaceUserRoles } from 'nocodb-sdk'

definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const route = useRoute()

const planTitle = route.query.plan as string
const paymentMode = route.query.paymentMode as 'month' | 'year'

const { hideSidebar, showTopbar, isNewSidebarEnabled } = storeToRefs(useSidebarStore())

const { loadPlans, plansAvailable } = useProvidePaymentStore()

const { navigateToCheckout } = useEeConfig()

const workspaceStore = useWorkspace()

const { workspacesList } = storeToRefs(workspaceStore)
const { loadWorkspaces } = workspaceStore

const filteredWorkspaces = computed(() => workspacesList.value.filter((w) => w.roles === WorkspaceUserRoles.OWNER))

const loadingWorkspaces = ref(false)

const goCheckout = async (workspaceId: string) => {
  await loadPlans()

  const plan =
    plansAvailable.value.find((p) => p.title === planTitle) || plansAvailable.value.filter((p) => p.title === PlanTitles.TEAM)[0]

  if (!plan) {
    return
  }

  navigateToCheckout(plan.id, paymentMode, 'pricing', workspaceId)
}

onMounted(() => {
  if (isNewSidebarEnabled.value) {
    hideSidebar.value = true
  }

  showTopbar.value = true

  loadingWorkspaces.value = true
  loadWorkspaces().then(() => {
    loadingWorkspaces.value = false
    if (workspacesList.value.length === 1) {
      const workspace = workspacesList.value[0]

      if (!workspace?.id) {
        return
      }

      goCheckout(workspace.id)
    }
  })
})
</script>

<template>
  <div>
    <NuxtLayout name="top">
      <div class="max-w-[1200px] mx-auto h-[calc(100vh-56px)]">
        <div class="px-4 md:px-8 pt-18 md:pt-[120px] pb-10 flex items-center justify-center">
          <div class="nc-workspace-selector-modal">
            <div class="flex flex-col gap-2">
              <div class="text-nc-content-gray-emphasis text-lg font-700">Select workspace to upgrade to Team Plan</div>
              <div class="text-sm leading-[18px] text-nc-content-gray-subtle2">
                Note that you can only upgrade workspaces where you are an owner, and where the workspace is not already on the
                same plan.
              </div>
            </div>
            <div class="border-1 border-nc-border-gray-medium rounded-lg p-2 overflow-auto nc-scrollbar-thin">
              <template v-for="workspace in filteredWorkspaces" :key="workspace.id">
                <div
                  v-if="workspace.id"
                  class="flex gap-3 w-full items-center cursor-pointer hover:bg-nc-bg-gray-light px-2 py-1.5 rounded-md"
                  @click="goCheckout(workspace.id)"
                >
                  <GeneralWorkspaceIcon :workspace="workspace" size="medium" />

                  <div class="flex-1 text-sm truncate font-semibold capitalize w-full">
                    {{ workspace.title }}
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </NuxtLayout>
  </div>
</template>

<style lang="scss" scoped>
.nc-workspace-selector-modal {
  @apply rounded-2xl border-1 border-nc-border-gray-medium p-6 flex flex-col gap-5 max-w-[min(100%,488px)] max-h-[calc(100vh_-_120px)] md:max-h-[calc(100vh_-_296px)];
  box-shadow: 0px 8px 8px -4px rgba(0, 0, 0, 0.04), 0px 20px 24px -4px rgba(0, 0, 0, 0.1);
}
</style>
