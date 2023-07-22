<script lang="ts" setup>
import NcLayout from '~icons/nc-icons/layout'
const { openedProject } = storeToRefs(useProjects())
const { activeTables } = storeToRefs(useTablesStore())

const defaultBase = computed(() => {
  return openedProject.value?.bases?.[0]
})

const { isUIAllowed } = useUIPermission()

const { isMobileMode } = useGlobal()

const activeKey = ref('allTables')

const baseSettingsState = ref('')
</script>

<template>
  <div class="h-full nc-project-view">
    <div
      class="flex flex-row pl-5 pr-3 border-b-1 border-gray-75 justify-between w-full"
      :class="{ 'nc-table-toolbar-mobile': isMobileMode, 'h-[var(--topbar-height)]': !isMobileMode }"
    >
      <div class="flex flex-row items-center gap-x-4">
        <GeneralProjectIcon :type="openedProject?.type" />
        <div class="flex font-medium text-base">
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
        <a-tab-pane key="allTables">
          <template #tab>
            <div class="tab-title" data-testid="proj-view-tab__all-tables">
              <NcLayout />
              <div>All tables</div>
              <div
                class="flex pl-1.25 px-1.5 py-0.75 rounded-md text-xs"
                :class="{
                  'bg-primary-selected': activeKey === 'allTables',
                  'bg-gray-50': activeKey !== 'allTables',
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
        <a-tab-pane v-if="isUIAllowed('shareProject')" key="accessSettings">
          <template #tab>
            <div class="tab-title" data-testid="proj-view-tab__access-settings">
              <GeneralIcon icon="users" class="!h-3.5 !w-3.5" />
              <div>Collaborators</div>
            </div>
          </template>
          <ProjectAccessSettings />
        </a-tab-pane>
        <a-tab-pane v-if="isUIAllowed('createBase')" key="dataSources">
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
