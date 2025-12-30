<script setup lang="ts">
import Details from '~/components/smartsheet/workflow/sidebar/Details.vue'
import NodeConfig from '~/components/smartsheet/workflow/sidebar/config/index.vue'
import TestStep from '~/components/smartsheet/workflow/sidebar/config/TestStep.vue'
import Result from '~/components/smartsheet/workflow/sidebar/config/Result.vue'
import ExecutionResult from '~/components/smartsheet/workflow/sidebar/config/ExecutionResult.vue'
import NodeDetails from '~/components/smartsheet/workflow/sidebar/NodeDetails.vue'
import LogSidebar from '~/components/smartsheet/workflow/sidebar/logs/index.vue'

const { selectedNode, activeTab, viewingExecution } = useWorkflowOrThrow()
</script>

<template>
  <div class="border-l-1 node-sidebar w-95 sidebar-config overflow-y-auto border-nc-border-gray-medium bg-nc-bg-default">
    <template v-if="activeTab === 'editor'">
      <Details v-if="!selectedNode" />
      <template v-else>
        <NodeDetails />
        <NodeConfig />
        <TestStep />
        <Result v-if="selectedNode.data?.testResult" />
      </template>
    </template>
    <template v-else-if="activeTab === 'logs'">
      <template v-if="viewingExecution && selectedNode">
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
