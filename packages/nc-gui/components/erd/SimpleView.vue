<script setup lang="ts">
import type { Edge, Node } from '@braks/vue-flow'
import { Background, Controls, VueFlow } from '@braks/vue-flow'
import type { ColumnType, FormulaType, LinkToAnotherRecordType, LookupType, RollupType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import dagre from 'dagre'
import TableNode from './TableNode.vue'
import RelationEdge from './RelationEdge.vue'
import MdiView from '~icons/mdi/eye-circle-outline'
import MdiTableLarge from '~icons/mdi/table-large'

interface Props {
  tables: any[]
  config: {
    showPkAndFk: boolean
    showViews: boolean
    showAllColumns: boolean
  }
}

const { tables, config } = defineProps<Props>()

const { metasWithIdAsKey } = useMetas()

const initialNodes = ref<Pick<Node, 'id' | 'data' | 'type'>[]>([])
const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])

const dagreGraph = new dagre.graphlib.Graph()
dagreGraph.setDefaultEdgeLabel(() => ({}))

const populateInitialNodes = () => {
  tables.forEach((table) => {
    if (!table.id) return

    const columns = metasWithIdAsKey.value[table.id].columns!.filter(
      (col) => config.showAllColumns || (!config.showAllColumns && col.uidt === UITypes.LinkToAnotherRecord),
    )

    dagreGraph.setNode(table.id, { width: 250, height: 50 * columns.length })

    initialNodes.value.push({
      id: table.id,
      data: { ...metasWithIdAsKey.value[table.id], showPkAndFk: config.showPkAndFk, showAllColumns: config.showAllColumns },
      type: 'custom',
    })
  })

  dagreGraph.setGraph({ rankdir: 'LR' })
}

const populateEdges = () => {
  const ltarColumns = tables.reduce<ColumnType[]>((acc, table) => {
    const meta = metasWithIdAsKey.value[table.id!]
    const columns = meta.columns?.filter(
      (column: ColumnType) => column.uidt === UITypes.LinkToAnotherRecord && column.system !== 1,
    )

    columns?.forEach((column: ColumnType) => {
      if ((column.colOptions as LinkToAnotherRecordType)?.type === 'hm') {
        acc.push(column)
      }

      if ((column.colOptions as LinkToAnotherRecordType).type === 'mm') {
        // Avoid duplicate mm connections
        const correspondingColumn = acc.find(
          (c) =>
            (c.colOptions as LinkToAnotherRecordType | FormulaType | RollupType | LookupType).type === 'mm' &&
            (c.colOptions as LinkToAnotherRecordType).fk_parent_column_id ===
              (column.colOptions as LinkToAnotherRecordType).fk_child_column_id &&
            (c.colOptions as LinkToAnotherRecordType).fk_child_column_id ===
              (column.colOptions as LinkToAnotherRecordType).fk_parent_column_id,
        )
        if (!correspondingColumn) {
          acc.push(column)
        }
      }
    })

    return acc
  }, [] as ColumnType[])

  edges.value = ltarColumns.map((column) => {
    const source = column.fk_model_id!
    const target = (column.colOptions as LinkToAnotherRecordType).fk_related_model_id!

    let sourceColumnId, targetColumnId

    if ((column.colOptions as LinkToAnotherRecordType).type === 'hm') {
      sourceColumnId = (column.colOptions as LinkToAnotherRecordType).fk_child_column_id
      targetColumnId = (column.colOptions as LinkToAnotherRecordType).fk_child_column_id
    }

    if ((column.colOptions as LinkToAnotherRecordType).type === 'mm') {
      sourceColumnId = (column.colOptions as LinkToAnotherRecordType).fk_parent_column_id
      targetColumnId = (column.colOptions as LinkToAnotherRecordType).fk_child_column_id
    }

    dagreGraph.setEdge(source, target)

    return {
      id: `e-${sourceColumnId}-${source}-${targetColumnId}-${target}`,
      source: `${source}`,
      target: `${target}`,
      sourceHandle: `s-${sourceColumnId}-${source}`,
      targetHandle: `d-${targetColumnId}-${target}`,
      type: 'custom',
      data: {
        column,
      },
    }
  })
}

const layoutNodes = () => {
  dagre.layout(dagreGraph)

  nodes.value = initialNodes.value.flatMap((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)

    if (!nodeWithPosition) return []

    return [{ ...node, position: { x: nodeWithPosition.x, y: nodeWithPosition.y } } as Node]
  })
}

onBeforeMount(async () => {
  populateInitialNodes()
  populateEdges()
  layoutNodes()
})
</script>

<template>
  <VueFlow :nodes="nodes" :edges="edges" :fit-view-on-init="true" :elevate-edges-on-select="true">
    <Controls class="!left-auto right-2 !top-3.5 !bottom-auto" :show-fit-view="false" :show-interactive="false" />

    <template #node-custom="props">
      <TableNode :data="props.data" />
    </template>

    <template #edge-custom="props">
      <RelationEdge v-bind="props" />
    </template>
    <Background />
    <div
      class="absolute bottom-0 right-0 flex flex-col text-xs bg-white px-2 py-1 border-1 rounded-md border-gray-200"
      style="font-size: 0.6rem"
    >
      <div class="flex flex-row items-center space-x-1 border-b-1 pb-1 border-gray-100">
        <MdiTableLarge class="text-primary" />
        <div>Table</div>
      </div>
      <div class="flex flex-row items-center space-x-1 pt-1">
        <MdiView class="text-primary" />
        <div>SQL View</div>
      </div>
    </div>
  </VueFlow>
</template>
