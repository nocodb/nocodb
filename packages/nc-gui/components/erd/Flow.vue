<script setup lang="ts">
import type { Edge, Node } from '@braks/vue-flow'
import { Background, Controls, VueFlow, useVueFlow } from '@braks/vue-flow'
import type { ColumnType, FormulaType, LinkToAnotherRecordType, LookupType, RollupType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import dagre from 'dagre'
import { onScopeDispose, watch } from '#imports'

interface Props {
  tables: any[]
  config: {
    showPkAndFk: boolean
    showViews: boolean
    showAllColumns: boolean
    singleTableMode: boolean
    showJunctionTableNames: boolean
  }
}

const { tables, config } = defineProps<Props>()

const { metasWithIdAsKey } = useMetas()

const { $destroy, fitView } = useVueFlow()

const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])

let dagreGraph: dagre.graphlib.Graph

const initDagre = () => {
  dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ rankdir: 'LR' })
}

const populateInitialNodes = () => {
  nodes.value = tables.flatMap((table) => {
    if (!table.id) return []

    const columns =
      metasWithIdAsKey.value[table.id].columns?.filter(
        (col) => config.showAllColumns || (!config.showAllColumns && col.uidt === UITypes.LinkToAnotherRecord),
      ) || []

    dagreGraph.setNode(table.id, { width: 250, height: 50 * columns.length })

    return [
      {
        id: table.id,
        data: { ...metasWithIdAsKey.value[table.id], showPkAndFk: config.showPkAndFk, showAllColumns: config.showAllColumns },
        type: 'custom',
        position: { x: 0, y: 0 },
      },
    ]
  })
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

  const edgeMMTableLabel = (modelId: string) => {
    const mmModel = metasWithIdAsKey.value[modelId]
    if (mmModel.title !== mmModel.table_name) {
      return `${mmModel.title} (${mmModel.table_name})`
    }
    return mmModel.title
  }

  edges.value = ltarColumns.map((column) => {
    const source = column.fk_model_id!
    const target = (column.colOptions as LinkToAnotherRecordType).fk_related_model_id!

    let sourceColumnId, targetColumnId
    let edgeLabel = ''

    if ((column.colOptions as LinkToAnotherRecordType).type === 'hm') {
      sourceColumnId = (column.colOptions as LinkToAnotherRecordType).fk_child_column_id
      targetColumnId = (column.colOptions as LinkToAnotherRecordType).fk_child_column_id
    }

    if ((column.colOptions as LinkToAnotherRecordType).type === 'mm') {
      sourceColumnId = (column.colOptions as LinkToAnotherRecordType).fk_parent_column_id
      targetColumnId = (column.colOptions as LinkToAnotherRecordType).fk_child_column_id
      edgeLabel = config.showJunctionTableNames
        ? edgeMMTableLabel((column.colOptions as LinkToAnotherRecordType).fk_mm_model_id!)
        : ''
    }

    if (source !== target) dagreGraph.setEdge(source, target)

    return {
      id: `e-${sourceColumnId}-${source}-${targetColumnId}-${target}-#${edgeLabel}`,
      source: `${source}`,
      target: `${target}`,
      sourceHandle: `s-${sourceColumnId}-${source}`,
      targetHandle: `d-${targetColumnId}-${target}`,
      type: 'custom',
      data: {
        column,
        isSelfRelation: source === target && sourceColumnId === targetColumnId,
        label: edgeLabel,
      },
    }
  })
}

const connectNonConnectedNodes = () => {
  const connectedNodes = new Set<string>()

  edges.value.forEach((edge) => {
    connectedNodes.add(edge.source)
    connectedNodes.add(edge.target)
  })

  const nonConnectedNodes = tables.filter((table) => !connectedNodes.has(table.id!))

  if (nonConnectedNodes.length === 0) return

  if (nonConnectedNodes.length === 1) {
    const firstTable = tables.find((table) => table.type === 'table' && table.id !== nonConnectedNodes[0].id)
    if (!firstTable) return

    dagreGraph.setEdge(nonConnectedNodes[0].id, firstTable.id)
    return
  }

  const firstNode = nonConnectedNodes[0]
  nonConnectedNodes.forEach((node, index) => {
    if (index === 0) return

    const source = firstNode.id
    const target = node.id

    dagreGraph.setEdge(source, target)
  })
}

const layoutNodes = () => {
  if (!config.singleTableMode) connectNonConnectedNodes()

  dagre.layout(dagreGraph)

  nodes.value = nodes.value.flatMap((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)

    if (!nodeWithPosition) return []

    return [{ ...node, position: { x: nodeWithPosition.x, y: nodeWithPosition.y } } as Node]
  })
}

const init = () => {
  initDagre()
  populateInitialNodes()
  populateEdges()
  layoutNodes()

  setTimeout(() => fitView({ duration: 300 }))
}

init()

onScopeDispose($destroy)

watch([() => tables, () => config], init, { deep: true, flush: 'pre' })
</script>

<template>
  <VueFlow :nodes="nodes" :edges="edges" elevate-edges-on-select>
    <Controls class="!left-auto right-2 !top-3.5 !bottom-auto" :show-fit-view="false" :show-interactive="false" />

    <template #node-custom="props">
      <LazyErdTableNode :data="props.data" />
    </template>

    <template #edge-custom="props">
      <LazyErdRelationEdge v-bind="props" />
    </template>

    <Background />

    <div
      v-if="!config.singleTableMode"
      class="absolute bottom-0 right-0 flex flex-col text-xs bg-white px-2 py-1 border-1 rounded-md border-gray-200 z-50 nc-erd-histogram"
      style="font-size: 0.6rem"
    >
      <div class="flex flex-row items-center space-x-1 border-b-1 pb-1 border-gray-100">
        <MdiTableLarge class="text-primary" />
        <div>{{ $t('objects.table') }}</div>
      </div>

      <div class="flex flex-row items-center space-x-1 pt-1">
        <MdiEyeCircleOutline class="text-primary" />
        <div>{{ $t('objects.sqlVIew') }}</div>
      </div>
    </div>
  </VueFlow>
</template>
