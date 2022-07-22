<script setup lang="ts">
const route = useRoute()
const { project } = useProject(true)
const { clearTabs, addTab } = useTabs()

addTab({ type: 'auth', title: 'Team & Auth' })

watch(
  () => route.params.projectId,
  async (newVal, oldVal) => {
    if (newVal !== oldVal) {
      clearTabs()
    }
  },
)
</script>

<template>
  <NuxtLayout>
    <template #sidebar>
      <DashboardTreeView />
    </template>

    <v-container fluid>
      <DashboardTabView />
    </v-container>
  </NuxtLayout>
</template>

<style scoped lang="scss">
.nc-container {
  .nc-topbar {
    position: fixed;
    top: 0;
    left: 0;
    height: 50px;
    width: 100%;
    z-index: 5;
  }

  .nc-sidebar {
    position: fixed;
    top: 50px;
    left: 0;
    height: calc(100% - 50px);
    width: 250px;
  }

  .nc-content {
    position: fixed;
    top: 50px;
    left: 250px;
    height: calc(100% - 50px);
    width: calc(100% - 250px);
  }
}
</style>
