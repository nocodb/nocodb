<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Edge, Node } from '@braks/vue-flow'
import { Background, MarkerType, VueFlow, isNode, useVueFlow } from '@braks/vue-flow'
import { ref } from 'vue'
import { ColumnType, UITypes } from 'nocodb-sdk'
import dagre from 'dagre'
import TableNode from './erd/TableNode.vue'
import RelationEdge from './erd/RelationEdge.vue'
import { useNuxtApp, useProject } from '#imports'

const dagreGraph = new dagre.graphlib.Graph()
dagreGraph.setDefaultEdgeLabel(() => ({}))

const { updateNodeInternals } = useVueFlow()

const { $api } = useNuxtApp()
const { project, tables } = useProject()
const { t } = useI18n()

const { metas, getMeta, metasWithId } = useMetas()

const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])

let isLoading = $ref(true)

const loadMetasOfTablesNotInMetas = async () => {
  await Promise.all(
    tables.value
      .filter((table) => !metas.value[table.id!])
      .map(async (table) => {
        await getMeta(table.id!)
      }),
  )
}

const populateTables = () => {
  Object.keys(metasWithId.value).forEach((tableId) => {
    nodes.value.push({
      id: tableId,
      data: metasWithId.value[tableId],
      type: 'custom',
    })
    dagreGraph.setNode(tableId, { width: 250, height: 30 * metasWithId.value[tableId].columns.length })
  })

  dagreGraph.setGraph({ rankdir: 'LR' })
}

const populateRelations = () => {
  const ltarColumns = Object.keys(metasWithId.value).reduce((acc, tableId) => {
    const table = metasWithId.value[tableId]
    const ltarColumns = table.columns.filter((column) => column.uidt === UITypes.LinkToAnotherRecord)

    ltarColumns.forEach((column) => {
      if (column.colOptions.type === 'hm') {
        acc.push(column)
      }

      if (column.colOptions.type === 'mm') {
        // Remove duplicate relations
        const relatedColumnId = column.colOptions.fk_child_column_id
        if (!acc.find((col) => col.id === relatedColumnId)) {
          acc.push(column)
        }
      }
    })

    return acc
  }, [])

  edges.value = ltarColumns.map((column: any) => {
    const source = column.fk_model_id
    const target = column.colOptions.fk_related_model_id

    dagreGraph.setEdge(source, target)

    return {
      id: `e${source}-${target}`,
      source: `${source}`,
      target: `${target}`,
      sourceHandle: `s-${column.id}-${source}`,
      targetHandle: `d-${column.id}-${target}`,
      type: 'custom',
      data: { column, table: metasWithId.value[source], relatedTable: metasWithId.value[target] },
      markerEnd: MarkerType.ArrowClosed,
    }
  })

  // console.log('json:elements', JSON.parse(JSON.stringify(elements)))
  // console.log('elements', elements)
}

const layoutNodes = () => {
  dagre.layout(dagreGraph)

  nodes.value = nodes.value.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    if (!nodeWithPosition) return node

    return { ...node, position: { x: nodeWithPosition.x, y: nodeWithPosition.y } }
  })
}

const populateElements = () => {
  populateTables()
}

onMounted(async () => {
  if (isLoading) {
    await loadMetasOfTablesNotInMetas()

    populateElements()
    populateRelations()
    layoutNodes()

    console.log('nodes', nodes.value)
    console.log('edges', edges.value)

    updateNodeInternals(nodes.value as any)
    isLoading = false
  }
})
</script>

<template>
  <div style="height: 650px">
    <div v-if="isLoading"></div>
    <VueFlow v-else :nodes="nodes" :edges="edges" :fit-view-on-init="true" :default-edge-options="{ type: 'step' }">
      <template #node-custom="props">
        <TableNode :data="props.data" />
      </template>
      <template #edge-custom="props">
        <RelationEdge v-bind="props" />
      </template>
      <Background />
    </VueFlow>
  </div>
</template>
