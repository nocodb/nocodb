<script setup lang="ts">
import { NC_DEFAULT_ORG_ID } from 'nocodb-sdk'

const { appInfo } = useGlobal()

const orgId = computed(() => appInfo.value?.defaultOrgId || NC_DEFAULT_ORG_ID)

const auditsStore = useAuditsStore()

const { loadActionOrgId } = storeToRefs(auditsStore)

const isAdminPanel = inject(IsAdminPanelInj, ref(false))

const { $api } = useNuxtApp()

const workspaceStore = useWorkspace()

onMounted(async () => {
  if (orgId.value) {
    loadActionOrgId.value = orgId.value

    // Load org workspaces for the workspace selector
    try {
      const { list } = await $api.orgWorkspace.list(orgId.value)
      if (list?.length) {
        for (const ws of list) {
          workspaceStore.workspaces.set(ws.id, ws)
        }
      }
    } catch {
      // Org workspaces may not be available on all setups
    }

    await auditsStore.onInit()
  }
})

onBeforeUnmount(() => {
  loadActionOrgId.value = undefined
  auditsStore.handleReset()
})
</script>

<template>
  <div
    class="p-6 h-full flex flex-col gap-6 overflow-auto nc-scrollbar-thin"
    :class="{
      'h-[calc(100vh-144px)]': isAdminPanel,
      'h-[calc(100vh-92px)]': !isAdminPanel,
    }"
  >
    <WorkspaceAuditsLogs />
  </div>
</template>
