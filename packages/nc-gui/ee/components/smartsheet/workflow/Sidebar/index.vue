<script setup lang="ts">
import Details from '~/components/smartsheet/workflow/Sidebar/Details.vue'
import NodeConfig from '~/components/smartsheet/workflow/Sidebar/Config/index.vue'
import TestStep from '~/components/smartsheet/workflow/Sidebar/Config/TestStep.vue'
import Result from '~/components/smartsheet/workflow/Sidebar/Config/Result.vue'
import NodeDetails from '~/components/smartsheet/workflow/Sidebar/NodeDetails.vue'

const { selectedNode, selectedNodeId } = useWorkflowOrThrow()
</script>

<template>
  <div class="border-l-1 node-sidebar w-100 sidebar-config border-nc-border-gray-medium bg-nc-bg-default">
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
  </div>
</template>

<style scoped lang="scss">
.sidebar-config {
  height: calc(100svh - (2 * var(--topbar-height)));
}
</style>
