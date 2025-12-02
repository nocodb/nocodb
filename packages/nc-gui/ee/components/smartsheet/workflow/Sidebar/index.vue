<script setup lang="ts">
import Details from '~/components/smartsheet/workflow/Sidebar/Details.vue'
import NodeConfig from '~/components/smartsheet/workflow/Sidebar/Config/index.vue'
import TestStep from '~/components/smartsheet/workflow/Sidebar/Config/TestStep.vue'
import Result from '~/components/smartsheet/workflow/Sidebar/Config/Result.vue'
import ExecutionResult from '~/components/smartsheet/workflow/Sidebar/Config/ExecutionResult.vue'
import NodeDetails from '~/components/smartsheet/workflow/Sidebar/NodeDetails.vue'
import LogSidebar from '~/components/smartsheet/workflow/Sidebar/Logs/index.vue'

const { selectedNode, selectedNodeId, activeTab, viewingExecution } = useWorkflowOrThrow()
</script>

<template>
  <div class="border-l-1 node-sidebar w-95 sidebar-config overflow-y-auto border-nc-border-gray-medium bg-nc-bg-default">
    <template v-if="activeTab === 'editor'">
      <Details v-if="!selectedNode" />
      <template v-else>
        <div class="border-b-1 border-nc-border-gray-medium py-2 px-1" @click="selectedNodeId = null">
          <NcButton type="text" size="small">
            <GeneralIcon icon="ncChevronLeft" />
          </NcButton>
        </div>
        <NodeDetails />
        <NodeConfig />
        <TestStep />
        <Result v-if="selectedNode.data?.testResult" />
      </template>
    </template>
    <template v-else-if="activeTab === 'logs'">
      <template v-if="viewingExecution && selectedNode">
        <div class="border-b-1 border-nc-border-gray-medium py-2 px-1" @click="selectedNodeId = null">
          <NcButton type="text" size="small">
            <GeneralIcon icon="ncChevronLeft" />
          </NcButton>
        </div>
        <NodeDetails read-only />
        <ExecutionResult />
      </template>
      <LogSidebar v-else />
    </template>
  </div>
</template>

<style scoped lang="scss">
.sidebar-config {
  height: calc(100svh - (2 * var(--topbar-height)));
}
</style>
