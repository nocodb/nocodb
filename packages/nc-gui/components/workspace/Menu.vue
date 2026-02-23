<script lang="ts" setup>
const isBaseListModalOpen = ref(false)
</script>

<template>
  <div class="nc-mini-sidebar-btn-full-width">
    <div
      data-testid="nc-workspace-menu"
      class="nc-workspace-menu nc-mini-sidebar-ws-item nc-small-shadow"
      @click="isBaseListModalOpen = true"
    >
      <GeneralWorkspaceIcon
        :workspace="{
          id: 'nc',
          meta: {},
        }"
        show-nocodb-icon
        class="flex-none border-1 border-nc-border-gray-medium"
        size="mini-sidebar"
      />
    </div>
  </div>

  <WorkspaceBaseListModal v-model:visible="isBaseListModalOpen" />
</template>
