<script lang="ts" setup>
import { PlanTitles, WorkspaceUserRoles } from 'nocodb-sdk'

definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const route = useRoute()

const planTitle = route.query.plan as string
const paymentMode = route.query.paymentMode as 'month' | 'year'

const { hideSidebar, showTopbar } = storeToRefs(useSidebarStore())

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
  hideSidebar.value = true
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
      <div class="max-w-[1200px] mx-auto py-10 flex items-center justify-center">
        <div class="flex flex-col">
          <div class="text-2xl font-bold mb-5">Choose a workspace to upgrade</div>
          <template v-for="workspace in filteredWorkspaces" :key="workspace.id">
            <div
              v-if="workspace.id"
              class="flex gap-2 w-full items-center cursor-pointer hover:bg-nc-bg-gray-light p-2 rounded-md"
              @click="goCheckout(workspace.id)"
            >
              <GeneralWorkspaceIcon :workspace="workspace" size="medium" />

              <div class="flex-1 text-xl truncate font-semibold leading-5 capitalize w-full">
                {{ workspace.title }}
              </div>
            </div>
          </template>
        </div>
      </div>
    </NuxtLayout>
  </div>
</template>
