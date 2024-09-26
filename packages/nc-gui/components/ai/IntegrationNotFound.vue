<script lang="ts" setup>
const workspaceStore = useWorkspace()

const navigateToAiIntegrations = () => {
  workspaceStore.navigateToIntegrations(undefined, undefined, {
    categories: 'ai',
  })
}
</script>

<template>
  <div class="py-2 pl-3 pr-2 flex items-center gap-2 bg-nc-bg-orange-light rounded-lg">
    <GeneralIcon icon="alertTriangleSolid" class="!text-nc-content-orange-medium w-4 h-4" />
    <div class="text-sm text-nc-content-gray-subtle flex-1">No AI Integrations added.</div>

    <NcButton size="small" type="text" class="!text-nc-content-brand" @click.stop="navigateToAiIntegrations">
      Add integration
    </NcButton>
  </div>
</template>

<style lang="scss" scoped></style>
