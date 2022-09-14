<script setup lang="ts">
import type { Edge } from '@braks/vue-flow'
import { Background, Controls, VueFlow, useVueFlow } from '@braks/vue-flow'
import { ref } from 'vue'
import { UITypes } from 'nocodb-sdk'
import dagre from 'dagre'
import TableNode from './erd/TableNode.vue'
import RelationEdge from './erd/RelationEdge.vue'
import { useProject } from '#imports'

const dagreGraph = new dagre.graphlib.Graph()
dagreGraph.setDefaultEdgeLabel(() => ({}))

const { updateNodeInternals, removeNodes, removeEdges, $reset } = useVueFlow()

const { tables } = useProject()
const { metas, getMeta, metasWithId } = useMetas()

const nodes = ref<any[]>([])
const edges = ref<Edge[]>([])
let isLoading = $ref(true)
const isLayouting = ref(false)
const config = ref({
  showPkAndFk: true,
  showViews: false,
})

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
  tables.value.forEach((table) => {
    if (!table?.id) return

    nodes.value.push({
      id: table.id,
      data: { ...metasWithId.value[table.id], showPkAndFk: config.value.showPkAndFk },
      type: 'custom',
    })
    dagreGraph.setNode(table.id, { width: 250, height: 30 * metasWithId.value[table.id].columns.length })
  })

  dagreGraph.setGraph({ rankdir: 'LR' })
}

const populateRelations = () => {
  const ltarColumns = Object.keys(metasWithId.value).reduce((acc: any[], tableId) => {
    const table = metasWithId.value[tableId]
    const ltarColumns = table.columns.filter((column: any) => column.uidt === UITypes.LinkToAnotherRecord)

    ltarColumns.forEach((column: any) => {
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
    const targetColumnId = column.colOptions.fk_related_column_id

    dagreGraph.setEdge(source, target)

    return {
      id: `e${source}-${target}`,
      source: `${source}`,
      target: `${target}`,
      sourceHandle: `s-${column.id}-${source}`,
      targetHandle: `d-${targetColumnId}-${target}`,
      type: 'custom',
      data: { column, table: metasWithId.value[source], relatedTable: metasWithId.value[target] },
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

const populateErd = () => {
  isLayouting.value = true
  populateElements()
  populateRelations()
  layoutNodes()

  updateNodeInternals(nodes.value as any)
  isLayouting.value = false
}

const resetElements = () => {
  $reset()
  updateNodeInternals(nodes.value as any)
  removeNodes(nodes.value)
  removeEdges(edges.value)
  nodes.value = []
  edges.value = []
  dagreGraph.nodes().forEach((node: any) => dagreGraph.removeNode(node))
  dagreGraph.edges().forEach((edge: any) => dagreGraph.removeEdge(edge))
}

onMounted(async () => {
  isLoading = true
  resetElements()

  await loadMetasOfTablesNotInMetas()

  isLoading = false
  populateErd()
})

watch(config.value, () => {
  populateErd()
})
</script>

<template>
  <div v-if="isLoading" style="height: 650px"></div>
  <div v-else class="relative" style="height: 650px">
    <VueFlow
      :key="config.toString()"
      :nodes="nodes"
      :edges="edges"
      :fit-view-on-init="true"
      :default-edge-options="{ type: 'step' }"
      :elevate-edges-on-select="true"
    >
      <Controls :show-fit-view="false" :show-interactive="false" />
      <template #node-custom="props">
        <TableNode :data="props.data" />
      </template>
      <template #edge-custom="props">
        <RelationEdge v-bind="props" />
      </template>
      <Background />
    </VueFlow>
    <div class="absolute top-4 right-4 flex-col bg-white py-2 px-4 border-1 border-gray-100 rounded-md z-50 space-y-1">
      <div class="flex flex-row items-center">
        <a-checkbox v-model:checked="config.showPkAndFk" />
        <span class="ml-2" style="font-size: 0.65rem">Show PK and FK</span>
      </div>
      <div class="flex flex-row items-center">
        <a-checkbox v-model:checked="config.showViews" />
        <span class="ml-2" style="font-size: 0.65rem">Show views</span>
      </div>
    </div>
  </div>
</template>
