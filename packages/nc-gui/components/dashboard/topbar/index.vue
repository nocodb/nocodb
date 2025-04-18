<script lang="ts" setup>
const props = defineProps<{
  workspaceId?: string
}>()

const navigateToWorkspace = () => {
  if (props.workspaceId) {
    navigateTo(`/${props.workspaceId}/settings`)
  }
}
</script>

<template>
  <div class="flex items-center justify-between w-full border-b-1 border-nc-gray-medium py-2 px-4 h-[56px]">
    <img class="cursor-pointer" width="32" alt="NocoDB" src="~/assets/img/icons/512x512.png" @click.stop="navigateToWorkspace" />
    <DashboardTopbarUserInfo />
  </div>
</template>
