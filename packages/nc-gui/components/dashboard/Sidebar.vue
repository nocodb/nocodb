<script lang="ts" setup>
const router = useRouter()
const route = $(router.currentRoute)

const { project } = storeToRefs(useProject())

const workspaceStore = useWorkspace()

const { workspace } = storeToRefs(workspaceStore)

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
</script>

<template>
  <div
    class="nc-sidebar flex flex-col bg-gray-50 outline-r-1 outline-gray-100"
    :style="{
      outlineWidth: '1px',
    }"
  >
    <div
      style="height: var(--header-height); border-bottom-width: 1px"
      :class="isOpen ? 'pl-4' : ''"
      class="flex items-center px-1 gap-1 nc-sidebar-header border-gray-100 py-2"
    >
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

      <WorkspaceMenu :workspace="workspace" :is-open="true" />
      <div
        class="nc-sidebar-left-toggle-icon hover:after:(bg-primary bg-opacity-75) group nc-sidebar-add-row flex items-center px-2"
      >
        <IcOutlineKeyboardDoubleArrowLeft
          v-e="['c:grid:toggle-navdraw']"
          class="cursor-pointer transform transition-transform duration-500"
          :class="{ 'rotate-180': !isOpen }"
          @click="isOpen = !isOpen"
        />
      </div>
    </div>

    <LazyDashboardTreeViewNew @create-base-dlg="toggleDialog(true, 'dataSources', null, projectId)" />
  </div>
</template>
