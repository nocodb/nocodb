<script lang="ts" setup>
import { PlanTitles, WorkspaceUserRoles } from 'nocodb-sdk'

definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const router = useRouter()

const route = router.currentRoute

const planTitle = (route.value.query.plan as string) ?? ''
const paymentMode = route.value.query.paymentMode as 'month' | 'year'

const { hideSidebar, showTopbar } = storeToRefs(useSidebarStore())

const { loadPlans, plansAvailable } = useProvidePaymentStore()

const { navigateToCheckout } = useEeConfig()

const workspaceStore = useWorkspace()

const { workspacesList } = storeToRefs(workspaceStore)
const { loadWorkspaces } = workspaceStore

const filteredWorkspaces = computed(() => workspacesList.value.filter((w) => w.roles === WorkspaceUserRoles.OWNER))

const isEmptyList = computed(() => !workspacesList.value.length)

const loadingWorkspaces = ref(true)

const goCheckout = async (workspaceId: string) => {
  await loadPlans()

  const plan =
    plansAvailable.value.find((p) => p.title.toLowerCase() === planTitle.toLowerCase()) ||
    plansAvailable.value.filter((p) => p.title === PlanTitles.PLUS)[0]

  if (!plan) {
    return
  }

  navigateToCheckout(plan.id, paymentMode, 'pricing', workspaceId)
}

const navigateToApp = () => {
  const newURL = window.location.origin + window.location.pathname
  window.history.pushState('object', document.title, `${newURL}#`)
  window.location.reload()
}

onMounted(() => {
  hideSidebar.value = true

  showTopbar.value = true

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
              <template v-if="loadingWorkspaces">
                <a-skeleton-input active class="!w-[38%] !h-5.5 !rounded-md !overflow-hidden" />
                <a-skeleton active :title="false" :paragraph="{ rows: 2 }" class="header-skeleton" />
              </template>
              <template v-else>
                <div class="text-nc-content-gray-emphasis text-lg font-700">
                  {{ isEmptyList ? 'No workspaces found' : 'Select workspace to upgrade to Plus Plan' }}
                </div>
                <div class="text-sm leading-[18px] text-nc-content-gray-subtle2">
                  {{
                    isEmptyList
                      ? 'This account does not own any workspaces. Log in with a different account or create a new workspace with this account.'
                      : 'Note that you can only upgrade workspaces where you are an owner, and where the workspace is not already on the same plan.'
                  }}
                </div>
              </template>
            </div>
            <div
              v-if="!isEmptyList || loadingWorkspaces"
              class="border-1 border-nc-border-gray-medium rounded-lg p-2 overflow-auto nc-scrollbar-thin"
              :class="{
                'flex flex-col gap-2': loadingWorkspaces,
              }"
            >
              <template v-if="loadingWorkspaces">
                <a-skeleton-input
                  v-for="i in 3"
                  :key="i"
                  active
                  class="workspace-item-skeleton !w-full !h-6 !rounded-md !overflow-hidden"
                />
              </template>
              <template v-else>
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
              </template>
            </div>
            <NcButton
              v-else
              full-width
              type="text"
              inner-class="children:(justify-center !text-captionBold text-nc-content-brand)"
              @click="navigateToApp"
            >
              Go to App
            </NcButton>
          </div>
        </div>
      </div>
    </NuxtLayout>
  </div>
</template>

<style lang="scss" scoped>
.nc-workspace-selector-modal {
  @apply rounded-2xl border-1 border-nc-border-gray-medium p-6 flex flex-col gap-5 max-w-[min(100%,488px)] w-full max-h-[calc(100vh_-_120px)] md:max-h-[calc(100vh_-_296px)];
  box-shadow: 0px 8px 8px -4px rgba(0, 0, 0, 0.04), 0px 20px 24px -4px rgba(0, 0, 0, 0.1);
}

:deep(.header-skeleton.ant-skeleton) {
  .ant-skeleton-paragraph {
    @apply mb-0 mt-2;
    li {
      @apply mt-2;
    }
  }
}
</style>
