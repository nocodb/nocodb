<script setup lang="ts">
import Details from '~/components/smartsheet/workflow/Sidebar/Details.vue'
import NodeConfig from '~/components/smartsheet/workflow/Sidebar/NodeConfig.vue'

const { isSidebarOpen, selectedNode } = useWorkflowOrThrow()
</script>

<template>
  <div
    :class="{
      'w-0 opacity-0': !isSidebarOpen,
      'w-100': isSidebarOpen,
    }"
    class="border-l-1 node-sidebar border-nc-border-gray-medium h-full bg-nc-bg-default"
  >
    <div class="gap-4 p-4 justify-between flex">
      <div class="text-subHeading1 text-nc-content-gray">
        {{ $t('general.properties') }}
      </div>

      <NcButton type="text" size="small" @click="isSidebarOpen = false">
        <GeneralIcon class="text-nc-content-gray-subtle" icon="close" />
      </NcButton>
    </div>

    <Details v-if="!selectedNode" />
    <NodeConfig v-else-if="selectedNode" />
  </div>

  <NcButton v-if="!isSidebarOpen" type="text" size="small" class="!absolute top-4 right-4" @click="isSidebarOpen = true">
    <GeneralIcon icon="ncSidebar" />
  </NcButton>
</template>
