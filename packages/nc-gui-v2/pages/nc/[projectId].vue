<script setup lang="ts">
import { watch } from "vue";
import useProject from "~/composables/useProject";
import useTabs from "~/composables/useTabs";

const route = useRoute();
const { loadProject, loadTables } = useProject();
const { clearTabs } = useTabs();

onMounted(async () => {
  await loadProject(route.params.projectId as string);
  await loadTables();
});

watch(
  () => route.params.projectId,
  async (newVal, oldVal) => {
    if (newVal !== oldVal) {
      clearTabs();
      if (newVal) {
        await loadProject(newVal as string);
        await loadTables();
      }
    }
  }
);
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
