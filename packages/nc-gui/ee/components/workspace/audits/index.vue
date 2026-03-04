<script lang="ts" setup>
interface Props {
  baseId?: string
}

defineProps<Props>()

const isAdminPanel = inject(IsAdminPanelInj, ref(false))

const isSettingsSidebar = inject(IsSettingsSidebarInj, ref(false))
</script>

<template>
  <div
    class="p-6 h-full flex flex-col gap-6 overflow-auto nc-scrollbar-thin"
    :class="{
      'h-[calc(100vh-var(--topbar-height))]': isSettingsSidebar,
      'h-[calc(100vh-144px)]': !isSettingsSidebar && isAdminPanel,
      'h-[calc(100vh-92px)]': !isSettingsSidebar && !isAdminPanel,
    }"
  >
    <WorkspaceAuditsLogs :base-id="baseId" />
  </div>
</template>
