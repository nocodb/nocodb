<script setup lang="ts">
import type { WorkflowNodeCategory } from 'nocodb-sdk'
import { IntegrationsType } from 'nocodb-sdk'
import IfNodeConfig from '~/components/smartsheet/workflow/sidebar/config/custom/If/index.vue'
import ListRecordsNodeConfig from '~/components/smartsheet/workflow/sidebar/config/custom/ListRecords.vue'
import CronTriggerNodeConfig from '~/components/smartsheet/workflow/sidebar/config/custom/CronTrigger.vue'
import RecordMatchesConditionTriggerConfig from '~/components/smartsheet/workflow/sidebar/config/custom/RecordMatchesConditionTrigger.vue'
import CreateRecordNodeConfig from '~/components/smartsheet/workflow/sidebar/config/custom/CreateRecord.vue'
import UpdateRecordNodeConfig from '~/components/smartsheet/workflow/sidebar/config/custom/UpdateRecord.vue'
import IterateNodeConfig from '~/components/smartsheet/workflow/sidebar/config/custom/Iterate.vue'
import WaitUntilNodeConfig from '~/components/smartsheet/workflow/sidebar/config/custom/WaitUntil.vue'
import RunScriptNodeConfig from '~/components/smartsheet/workflow/sidebar/config/custom/RunScript/index.vue'
import { findIterateNodePortForPath } from '~/utils/workflowUtils'

const {
  selectedNodeId,
  updateNode,
  getNodeMetaById,
  selectedNode,
  nodes,
  edges,
  fetchNodeIntegrationOptions,
  clearChildNodesTestResults,
} = useWorkflowOrThrow()

provide(isWorkflowInj, ref(true))

/**
 * Get available variables from all upstream nodes for a given node
 * These are the output variables from nodes that have been tested and come before this node
 * @param nodeId - The node ID to get available variables for
 * @returns Array of variable definitions with node context
 */
const getAvailableVariables = (nodeId: string) => {
  const parentNodeIds = findAllParentNodes(nodeId, edges.value)
  const variables: Array<{
    nodeId: string
    nodeTitle: string
    nodeIcon?: string
    variables: any[]
    category: WorkflowNodeCategory
  }> = []

  for (const parentId of parentNodeIds) {
    const parentNode = nodes.value.find((n) => n.id === parentId)
    if (!parentNode) continue

    // Skip nodes without test results or output variables
    const testResult = parentNode.data?.testResult
    if (!testResult?.outputVariables || testResult.outputVariables.length === 0) continue

    // Get node definition to access the icon
    const nodeMeta = getNodeMetaById(parentNode.type)
    const nodeIcon = nodeMeta?.icon

    const nodePrefix = `$('${parentNode.data?.title || parentId}')`

    // For iterate nodes, filter variables based on which port path leads to current node
    let filteredVariables = testResult.outputVariables
    if (parentNode.type === 'core.flow.iterate') {
      // Find which output port from the iterate node leads to the current node
      const portId = findIterateNodePortForPath(parentId, nodeId, edges.value)

      // Filter variables by port if we have a port ID
      if (portId) {
        filteredVariables = testResult.outputVariables.filter((v: any) => v.extra?.port === portId)
      }
    }

    // Add the node's variables with node context, recursively prefixing all keys
    variables.push({
      nodeId: parentId,
      nodeTitle: parentNode.data?.title || parentId,
      nodeIcon,
      category: nodeMeta.category,
      variables: filteredVariables.map((v: any) => ({
        ...prefixVariableKeysRecursive(v, nodePrefix),
        extra: {
          ...v.extra,
          sourceNodeId: parentId,
          sourceNodeTitle: parentNode.data?.title || parentId,
          nodeIcon,
        },
      })),
    })
  }

  return variables
}

/**
 * Get a flat list of all available variables for a node
 * @param nodeId - The node ID to get available variables for
 * @returns Flat array of variable definitions
 */
const getAvailableVariablesFlat = (nodeId: string) => {
  const groupedVariables = getAvailableVariables(nodeId)
  return groupedVariables.flatMap((group) => group.variables)
}

provide(WorkflowVariableInj, {
  selectedNodeId,
  getAvailableVariables,
  getAvailableVariablesFlat,
})

const FormNodeMap = {
  'core.flow.if': IfNodeConfig,
  'nocodb.list_records': ListRecordsNodeConfig,
  'core.trigger.cron': CronTriggerNodeConfig,
  'nocodb.trigger.record_matches_condition': RecordMatchesConditionTriggerConfig,
  'nocodb.create_record': CreateRecordNodeConfig,
  'nocodb.update_record': UpdateRecordNodeConfig,
  'core.flow.iterate': IterateNodeConfig,
  'core.flow.wait-until': WaitUntilNodeConfig,
  'nocodb.run_script': RunScriptNodeConfig,
}

const formSchema = computed(() => {
  if (!selectedNode.value || !selectedNode.value.type) return []
  const nodeMeta = getNodeMetaById(selectedNode.value.type)
  return nodeMeta?.form || []
})

const { formState } = useProvideFormBuilderHelper({
  formSchema,
  initialState: computed(() => selectedNode.value?.data || {}),
  onChange: () => {
    if (!selectedNodeId.value) return
    updateNode(selectedNodeId.value, {
      data: {
        ...selectedNode.value?.data,
        ...formState.value,
        testResult: {
          ...(selectedNode.value?.data?.testResult || {}),
          isStale: true,
        },
      },
    })

    clearChildNodesTestResults(selectedNodeId.value)
  },
  fetchOptions: async (key: string) => {
    return fetchNodeIntegrationOptions(
      {
        ...formState.value,
        type: IntegrationsType.WorkflowNode,
        sub_type: selectedNode.value.type,
      },
      key,
    )
  },
})
</script>

<template>
  <NcGroupedSettings v-if="selectedNode && (formSchema.length > 0 || selectedNode.type in FormNodeMap)" title="Inputs">
    <component :is="FormNodeMap[selectedNode.type]" v-if="selectedNode.type in FormNodeMap" />
    <NcFormBuilder v-else-if="formSchema.length > 0" />
  </NcGroupedSettings>
</template>

<style scoped lang="scss"></style>
