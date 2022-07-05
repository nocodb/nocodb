<script setup lang="ts">
import { watch } from 'vue'
import { useProject } from '~/composables/project'
import { useTabs } from '~/composables/tabs'

const route = useRoute()
const { user } = useUser()
const { loadProject, loadTables } = useProject()
const { clearTabs } = useTabs()

onMounted(async () => {
  await loadProject(route.params.projectId as string)
  await loadTables()
})

watch(
  () => route.params.projectId,
  async (newVal, oldVal) => {
    if (newVal && newVal !== oldVal) {
      clearTabs()
      await loadProject(newVal as string)
      await loadTables()
    }
  },
)
</script>

<template>
  <NuxtLayout>
    <v-navigation-drawer color="" permanent>
      <DashboardTreeView />
    </v-navigation-drawer>
    <v-main>
      <v-container>
        <DashboardTabView />
      </v-container>
    </v-main>
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
