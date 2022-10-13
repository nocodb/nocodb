import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import dagre from 'dagre'
import type { Edge, Elements } from '@vue-flow/core'
import type { MaybeRef } from '@vueuse/core'
import { Position, isEdge, isNode } from '@vue-flow/core'
import { computed, ref, unref, useMetas } from '#imports'

export interface ErdFlowConfig {
  showPkAndFk: boolean
  showViews: boolean
  showAllColumns: boolean
  singleTableMode: boolean
  showJunctionTableNames: boolean
}

export function useErdElements(tables: MaybeRef<TableType[]>, props: MaybeRef<ErdFlowConfig>) {
  const elements = ref<Elements>([])

  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ rankdir: 'LR' })

  const { metasWithIdAsKey } = useMetas()

  const erdTables = computed(() => unref(tables))
  const config = $computed(() => unref(props))

  const ltarColumns = computed(() =>
    erdTables.value.reduce((acc, table) => {
      const meta = metasWithIdAsKey.value[table.id!]
      const columns = meta.columns?.filter(
        (column: ColumnType) => column.uidt === UITypes.LinkToAnotherRecord && column.system !== 1,
      )

      columns?.forEach((column: ColumnType) => {
        const colOptions = column.colOptions as LinkToAnotherRecordType

        if (colOptions.type === 'hm') {
          return acc.push(column)
        }

        if (colOptions.type === 'mm') {
          // Avoid duplicate mm connections
          const correspondingColumn = acc.find((c) => {
            const correspondingColOptions = c.colOptions as LinkToAnotherRecordType

            return (
              correspondingColOptions.type === 'mm' &&
              correspondingColOptions.fk_parent_column_id === colOptions.fk_child_column_id &&
              correspondingColOptions.fk_child_column_id === colOptions.fk_parent_column_id
            )
          })
          if (!correspondingColumn) {
            return acc.push(column)
          }
        }
      })

      return acc
    }, [] as ColumnType[]),
  )

  const edgeMMTableLabel = (modelId: string) => {
    const mmModel = metasWithIdAsKey.value[modelId]

    if (mmModel.title !== mmModel.table_name) {
      return `${mmModel.title} (${mmModel.table_name})`
    }

    return mmModel.title
  }

  function createNodes() {
    return erdTables.value.flatMap((table) => {
      if (!table.id) return []

      const columns =
        metasWithIdAsKey.value[table.id].columns?.filter(
          (col) => config.showAllColumns || (!config.showAllColumns && col.uidt === UITypes.LinkToAnotherRecord),
        ) || []

      return [
        {
          id: table.id,
          data: {
            ...metasWithIdAsKey.value[table.id],
            showPkAndFk: config.showPkAndFk,
            showAllColumns: config.showAllColumns,
            columnLength: columns.length,
          },
          type: 'custom',
          position: { x: 0, y: 0 },
        },
      ]
    })
  }

  function createEdges() {
    return ltarColumns.value.reduce<Edge[]>((acc, column) => {
      const source = column.fk_model_id!
      const target = (column.colOptions as LinkToAnotherRecordType).fk_related_model_id!

      const hasSource = erdTables.value.find((table) => table.id === source)
      const hasTarget = erdTables.value.find((table) => table.id === target)

      if (!hasSource || !hasTarget) return acc

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

      acc.push({
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
      })

      return acc
    }, [])
  }

  function connectNonConnectedNodes() {
    const connectedNodes = new Set<string>()

    elements.value.forEach((el) => {
      if (isEdge(el)) {
        connectedNodes.add(el.source)
        connectedNodes.add(el.target)
      }
    })

    const nonConnectedNodes = erdTables.value.filter((table) => !connectedNodes.has(table.id!))

    if (nonConnectedNodes.length === 0) return

    if (nonConnectedNodes.length === 1) {
      const firstTable = erdTables.value.find((table) => table.type === 'table' && table.id !== nonConnectedNodes[0].id)
      if (!firstTable) return

      dagreGraph.setEdge(nonConnectedNodes[0].id!, firstTable.id!)
      return
    }

    const firstNode = nonConnectedNodes[0]
    nonConnectedNodes.forEach((node, index) => {
      if (index === 0) return

      const source = firstNode.id!
      const target = node.id!

      dagreGraph.setEdge(source, target)
    })
  }

  const layout = () => {
    elements.value = [...createNodes(), ...createEdges()]

    if (!config.singleTableMode) connectNonConnectedNodes()
    elements.value.forEach((el) => {
      if (isNode(el)) {
        dagreGraph.setNode(el.id, { width: 250, height: 50 * el.data.columnLength })
      } else if (isEdge(el)) {
        dagreGraph.setEdge(el.source, el.target)
      }
    })

    dagre.layout(dagreGraph)

    elements.value.forEach((el) => {
      if (isNode(el)) {
        const nodeWithPosition = dagreGraph.node(el.id)
        el.targetPosition = Position.Left
        el.sourcePosition = Position.Right
        el.position = { x: nodeWithPosition.x, y: nodeWithPosition.y }
      }
    })
  }

  return {
    elements,
    layout,
  }
}
