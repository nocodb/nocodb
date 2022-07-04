<template>

  <NuxtLayout>
    <v-navigation-drawer color="" permanent>

      <DashboardTreeView></DashboardTreeView>
    </v-navigation-drawer>
    <v-main>
      <v-container>
        <DashboardTabView></DashboardTabView>
      </v-container>


    </v-main>
  </NuxtLayout>


<!--  <NuxtLayout>
    &lt;!&ndash;  todo: move to layout or create a reusable component &ndash;&gt;
    <div class="nc-container">
      <div class="nc-topbar shadow-2">
      </div>
      <div class="nc-sidebar shadow-2 p-4 overflow-y-auto">
        <DashboardTreeView></DashboardTreeView>
      </div>
      <div class="nc-content p-4 overflow-auto">
        <DashboardTabView></DashboardTabView>
      </div>
    </div>

  </NuxtLayout>-->
</template>

<script setup lang="ts">
import { useProject } from "~/composables/project";
import { watch } from "vue";
import { useTabs } from "~/composables/tabs";

const route = useRoute();
const { loadProject, loadTables } = useProject();
const { clearTabs } = useTabs();
const {user} = useUser()


onMounted(async () => {
  await loadProject(route.params.projectId as string);
  await loadTables();
});

watch(() => route.params.projectId, async (newVal, oldVal) => {
  if (newVal && newVal !== oldVal) {
    clearTabs();
    await loadProject(newVal as string);
    await loadTables();
  }
});

</script>

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
