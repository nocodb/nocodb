<script setup lang="ts">
import type { Edge, Node } from '@braks/vue-flow'
import { Background, Controls, VueFlow, useVueFlow } from '@braks/vue-flow'
import { UITypes } from 'nocodb-sdk'
import dagre from 'dagre'
import TableNode from './erd/TableNode.vue'
import RelationEdge from './erd/RelationEdge.vue'

let dagreGraph = new dagre.graphlib.Graph()
dagreGraph.setDefaultEdgeLabel(() => ({}))

const { setNodes, setEdges } = useVueFlow()

const { tables } = useProject()

const { metas, getMeta, metasWithId } = useMetas()

const initialNodes = ref<Pick<Node, 'id' | 'data' | 'type'>[]>([])

const nodes = ref<Node[]>([])

const edges = ref<Edge[]>([])

let isLoading = $ref(true)

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
  tables.value
    .filter((table) => (!config.value.showViews && table.type !== 'view') || config.value.showViews)
    .forEach((table) => {
      if (!table.id) return

      dagreGraph.setNode(table.id, { width: 250, height: 30 * metasWithId.value[table.id].columns.length })

      initialNodes.value.push({
        id: table.id,
        data: { ...metasWithId.value[table.id], showPkAndFk: config.value.showPkAndFk },
        type: 'custom',
      })
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

  nodes.value = initialNodes.value.flatMap((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)

    if (!nodeWithPosition) return []

    return [{ ...node, position: { x: nodeWithPosition.x, y: nodeWithPosition.y } } as Node]
  })
}

const populateElements = () => {
  populateTables()
}

const resetElements = () => {
  setNodes([])
  setEdges([])
  initialNodes.value = []
  nodes.value = []
  edges.value = []
}

const populateErd = (shouldReset = false) => {
  if (shouldReset) {
    dagreGraph = new dagre.graphlib.Graph()
    dagreGraph.setDefaultEdgeLabel(() => ({}))

    resetElements()
  }

  populateElements()
  populateRelations()
  layoutNodes()
  console.log('nodes', nodes.value)
  console.log('edges', edges.value)
}

onBeforeMount(async () => {
  isLoading = true

  await loadMetasOfTablesNotInMetas()

  isLoading = false

  populateErd()
})

onBeforeUnmount(() => {
  resetElements()
})

watch(config.value, () => populateErd(true))
</script>

<template>
  <div v-if="isLoading" style="height: 650px"></div>
  <div v-else class="relative" style="height: 650px">
    <VueFlow :nodes="nodes" :edges="edges" :fit-view-on-init="true" :elevate-edges-on-select="true">
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
