<script lang="ts" setup>
const { openedProject } = storeToRefs(useProjects())

const defaultBase = computed(() => {
  return openedProject.value?.bases?.[0]
})

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
      class="flex mx-12 my-8"
      :style="{
        height: 'calc(100% - var(--topbar-height))',
      }"
    >
      <a-tabs v-model:activeKey="activeKey" class="w-full">
        <a-tab-pane key="allTables" tab="All Tables">
          <ProjectAllTables />
        </a-tab-pane>
        <!-- <a-tab-pane v-if="defaultBase" key="erd" tab="Project ERD" force-render class="pt-4 pb-12">
          <ErdView :base-id="defaultBase!.id" class="!h-full" />
        </a-tab-pane> -->
        <a-tab-pane key="dataSources" tab="Data sources">
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
</style>
