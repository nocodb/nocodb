<script lang="ts" setup>
const router = useRouter()

const route = $(router.currentRoute)

const workspaceStore = useWorkspace()

const { activeWorkspace } = storeToRefs(workspaceStore)

const { isOpen } = storeToRefs(useSidebarStore())

const dialogOpen = ref(false)

const openDialogKey = ref<string>('')

const dataSourcesState = ref<string>('')

const projectId = ref<string>()

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
</script>

<template>
  <div
    class="nc-sidebar flex flex-col bg-gray-50 outline-r-1 outline-gray-100 select-none"
    :style="{
      outlineWidth: '1px',
    }"
  >
    <div style="height: var(--header-height)">
      <div style="border-bottom-width: 1px" class="flex items-center px-1 nc-sidebar-header !border-0 py-1.5 pl-2">
        <div class="flex flex-row flex-grow hover:bg-gray-100 pl-2 pr-1 py-0.5 rounded-md">
          <div
            v-if="!isSharedBase"
            v-e="['c:navbar:home']"
            data-testid="nc-noco-brand-icon"
            class="w-[29px] min-w-[29px] transition-all duration-200 py-1 cursor-pointer transform hover:scale-105 nc-noco-brand-icon"
            @click="navigateTo('/')"
          >
            <a-tooltip placement="bottom">
              <template #title>
                {{ currentVersion }}
              </template>
              <img width="25" class="-mr-1" alt="NocoDB" src="~/assets/img/icons/512x512.png" />
            </a-tooltip>
          </div>

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

          <WorkspaceMenu :workspace="activeWorkspace" :is-open="true" />
        </div>

        <div
          class="nc-sidebar-left-toggle-icon hover:after:(bg-primary bg-opacity-75) group nc-sidebar-add-row flex items-center ml-0.5 pr-0.5 h-full"
        >
          <IcOutlineKeyboardDoubleArrowLeft
            v-e="['c:grid:toggle-navdraw']"
            class="cursor-pointer transform transition-transform duration-500 p-0.75 h-6.25 w-6.25 rounded-md hover:bg-gray-100"
            :class="{ 'rotate-180': !isOpen }"
            @click="isOpen = !isOpen"
          />
        </div>
      </div>

      <div class="w-full mt-2"></div>

      <div role="button" class="nc-sidebar-top-button" @click="navigateTo('/')">
        <MaterialSymbolsHomeOutlineRounded class="!h-3.9" />
        <div>Home</div>
      </div>

      <div role="button" class="nc-sidebar-top-button">
        <PhMagnifyingGlassBold class="!h-3.3" />
        <div>Search</div>
      </div>

      <WorkspaceCreateProjectBtn modal type="text" class="!p-0" :active-workspace-id="route.params.workspaceId">
        <div class="gap-x-2 flex flex-row w-full items-center nc-sidebar-top-button !my-0">
          <MdiPlus class="!h-4" />

          <div class="flex">New Project</div>
        </div>
      </WorkspaceCreateProjectBtn>

      <div class="text-gray-500 mx-5 font-medium mt-3.5 mb-1.5">Projects</div>
      <div
        class="w-full border-b-1"
        :class="{
          'border-gray-100': !isTreeViewOnScrollTop,
          'border-transparent': isTreeViewOnScrollTop,
        }"
      ></div>
    </div>
    <LazyDashboardTreeViewNew
      @create-base-dlg="toggleDialog(true, 'dataSources', null, projectId)"
      @on-scroll-top="onTreeViewScrollTop"
    />
  </div>
</template>

<style lang="scss" scoped>
.nc-sidebar-top-button {
  @apply flex flex-row mx-1 px-3.5 rounded-md items-center py-0.75 my-0.5 gap-x-2 hover:bg-gray-100 cursor-pointer;
}
</style>
