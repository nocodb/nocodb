<script setup lang="ts">
const orgStore = useOrg()

const { org } = storeToRefs(orgStore)

const auditsStore = useAuditsStore()

const { loadActionOrgId } = storeToRefs(auditsStore)

const isAdminPanel = inject(IsAdminPanelInj, ref(false))

onMounted(async () => {
  if (org.value?.id) {
    loadActionOrgId.value = org.value.id
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
