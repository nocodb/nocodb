<script lang="ts" setup>
import { useTitle } from '@vueuse/core'
import NcLayout from '~icons/nc-icons/layout'
const { openedProject } = storeToRefs(useProjects())
const { activeTables } = storeToRefs(useTablesStore())
const { activeWorkspace } = storeToRefs(useWorkspace())

const { navigateToProjectPage } = useProject()

const router = useRouter()
const route = router.currentRoute

/* const defaultBase = computed(() => {
  return openedProject.value?.bases?.[0]
}) */

const { isUIAllowed } = useUIPermission()

const { isMobileMode } = useGlobal()

const activeKey = ref<'allTable' | 'collaborator' | 'data-source'>('allTable')

const baseSettingsState = ref('')

watch(
  () => route.value.query?.page,
  (newVal, oldVal) => {
    if (newVal && newVal !== oldVal) {
      if (newVal === 'collaborator') {
        activeKey.value = 'collaborator'
      } else if (newVal === 'data-source') {
        activeKey.value = 'data-source'
      } else {
        activeKey.value = 'allTable'
      }
    }
  },
  { immediate: true },
)

watch(activeKey, () => {
  if (activeKey.value) {
    navigateToProjectPage({
      page: activeKey.value as any,
    })
  }
})

watch(
  () => openedProject.value?.title,
  () => {
    useTitle(`${openedProject.value?.title ?? activeWorkspace.value?.title ?? 'NocoDB'}`)
  },
)
</script>

<template>
  <div class="h-full nc-project-view">
    <div
      class="flex flex-row pl-2 pr-2 border-b-1 border-gray-200 justify-between w-full"
      :class="{ 'nc-table-toolbar-mobile': isMobileMode, 'h-[var(--topbar-height)]': !isMobileMode }"
    >
      <div class="flex flex-row items-center gap-x-4">
        <GeneralOpenLeftSidebarBtn />
        <GeneralProjectIcon :type="openedProject?.type" />
        <div class="flex font-medium text-base capitalize">
          {{ openedProject?.title }}
        </div>
      </div>
      <LazyGeneralShareProject />
    </div>
    <div
      class="flex mx-12 my-8 nc-project-view-tab"
      :style="{
        height: 'calc(100% - var(--topbar-height))',
      }"
    >
      <a-tabs v-model:activeKey="activeKey" class="w-full">
        <a-tab-pane key="allTable">
          <template #tab>
            <div class="tab-title" data-testid="proj-view-tab__all-tables">
              <NcLayout />
              <div>All tables</div>
              <div
                class="flex pl-1.25 px-1.5 py-0.75 rounded-md text-xs"
                :class="{
                  'bg-primary-selected': activeKey === 'allTable',
                  'bg-gray-50': activeKey !== 'allTable',
                }"
              >
                {{ activeTables.length }}
              </div>
            </div>
          </template>
          <ProjectAllTables />
        </a-tab-pane>
        <!-- <a-tab-pane v-if="defaultBase" key="erd" tab="Project ERD" force-render class="pt-4 pb-12">
          <ErdView :base-id="defaultBase!.id" class="!h-full" />
        </a-tab-pane> -->
        <a-tab-pane v-if="isUIAllowed('shareProject')" key="collaborator">
          <template #tab>
            <div class="tab-title" data-testid="proj-view-tab__access-settings">
              <GeneralIcon icon="users" class="!h-3.5 !w-3.5" />
              <div>Collaborator</div>
            </div>
          </template>
          <ProjectAccessSettings />
        </a-tab-pane>
        <a-tab-pane v-if="isUIAllowed('createBase')" key="data-source">
          <template #tab>
            <div class="tab-title" data-testid="proj-view-tab__data-sources">
              <GeneralIcon icon="database" />
              <div>Data sources</div>
            </div>
          </template>
          <DashboardSettingsDataSources v-model:state="baseSettingsState" />
        </a-tab-pane>
      </a-tabs>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.ant-tabs-content) {
  @apply !h-full;
}
:deep(.ant-tabs-nav) {
  @apply !mb-0;
}

.tab-title {
  @apply flex flex-row items-center gap-x-2 px-2;
}
:deep(.ant-tabs-tab .tab-title) {
  @apply text-gray-500;
}
:deep(.ant-tabs-tab-active .tab-title) {
  @apply text-primary;
}
</style>
