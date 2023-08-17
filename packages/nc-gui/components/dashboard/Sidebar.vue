<script lang="ts" setup>
import { useGlobal } from '#imports'

const router = useRouter()

const route = router.currentRoute

const workspaceStore = useWorkspace()

const { activeWorkspace } = storeToRefs(workspaceStore)

const { navigateToWorkspaceSettings } = useWorkspace()

const { isUIAllowed } = useUIPermission()

const dialogOpen = ref(false)

const openDialogKey = ref<string>('')

const dataSourcesState = ref<string>('')

const projectId = ref<string>()

const isCreateProjectOpen = ref(false)

function toggleDialog(value?: boolean, key?: string, dsState?: string, pId?: string) {
  dialogOpen.value = value ?? !dialogOpen.value
  openDialogKey.value = key || ''
  dataSourcesState.value = dsState || ''
  projectId.value = pId || ''
}

// todo:
const isSharedBase = ref(false)
const currentVersion = ref('')

const isTreeViewOnScrollTop = ref(true)
const onTreeViewScrollTop = (onScrollTop: boolean) => {
  isTreeViewOnScrollTop.value = !onScrollTop
}

const { appInfo } = useGlobal()

const navigateToHome = () => {
  if (appInfo.value.baseHostName) {
    window.location.href = `https://app.${appInfo.value.baseHostName}/dashboard`
  } else {
    navigateToWorkspaceSettings()
  }
}
</script>

<template>
  <div
    class="nc-sidebar flex flex-col bg-gray-50 outline-r-1 outline-gray-100 select-none"
    :style="{
      outlineWidth: '1px',
    }"
  >
    <div style="height: var(--sidebar-top-height)">
      <div style="border-bottom-width: 1px" class="flex items-center px-1 nc-sidebar-header !border-0 py-1.25 pl-2">
        <div class="flex flex-row flex-grow hover:bg-gray-100 pl-2 pr-1 py-0.5 rounded-md max-w-full">
          <a
            v-if="isSharedBase"
            class="w-[40px] min-w-[40px] transition-all duration-200 p-1 cursor-pointer transform hover:scale-105"
            href="https://github.com/nocodb/nocodb"
            target="_blank"
          >
            <a-tooltip placement="bottom">
              <template #title>
                {{ currentVersion }}
              </template>
              <img width="25" alt="NocoDB" src="~/assets/img/icons/512x512-trans.png" />
            </a-tooltip>
          </a>

          <WorkspaceMenu :workspace="activeWorkspace" :is-open="true">
            <template #brandIcon>
              <div
                v-if="!isSharedBase"
                v-e="['c:navbar:home']"
                data-testid="nc-noco-brand-icon"
                class="w-[29px] min-w-[29px] nc-noco-brand-icon"
              >
                <img width="25" class="mr-0" alt="NocoDB" src="~/assets/img/icons/512x512.png" />
              </div>
            </template>
          </WorkspaceMenu>
        </div>
      </div>

      <div class="w-full mt-2"></div>

      <div role="button" class="nc-sidebar-top-button" data-testid="nc-sidebar-home-btn" @click="navigateToHome">
        <GeneralIcon icon="settings" class="!h-3.9" />
        <div>Workspace Settings</div>
      </div>
      <WorkspaceCreateProjectBtn
        v-if="isUIAllowed('createProject', false, activeWorkspace?.roles)"
        v-model:is-open="isCreateProjectOpen"
        modal
        type="text"
        class="!p-0 mx-1"
        data-testid="nc-sidebar-create-project-btn"
        :active-workspace-id="route.params.workspaceId"
      >
        <div
          class="gap-x-2 flex flex-row w-full items-center nc-sidebar-top-button !my-0 !ml-0"
          :class="{
            'border-gray-200': !isTreeViewOnScrollTop,
            'border-transparent': isTreeViewOnScrollTop,
            'bg-gray-100': isCreateProjectOpen,
          }"
        >
          <MdiPlus class="!h-4" />

          <div class="flex">{{ $t('title.newProj') }}</div>
        </div>
      </WorkspaceCreateProjectBtn>
      <div v-else class="!h-7"></div>
      <div class="text-gray-500 mx-5 font-medium mt-3 mb-1.5">{{ $t('objects.projects') }}</div>
      <div
        class="w-full border-b-1"
        :class="{
          'border-gray-100': !isTreeViewOnScrollTop,
          'border-transparent': isTreeViewOnScrollTop,
        }"
      ></div>
    </div>
    <LazyDashboardTreeViewNew
      @create-base-dlg="toggleDialog(true, 'dataSources', undefined, projectId)"
      @on-scroll-top="onTreeViewScrollTop"
    />
  </div>
</template>

<style lang="scss" scoped>
.nc-sidebar-top-button {
  @apply flex flex-row mx-1 px-3.5 rounded-md items-center py-0.75 my-0.5 gap-x-2 hover:bg-gray-200 cursor-pointer;
}
</style>
