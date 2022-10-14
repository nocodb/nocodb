import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import dagre from 'dagre'
import type { Edge, Elements } from '@vue-flow/core'
import type { MaybeRef } from '@vueuse/core'
import { Position, isEdge, isNode } from '@vue-flow/core'
import { scaleLinear as d3ScaleLinear } from 'd3-scale'
import { computed, ref, unref, useMetas, useTheme } from '#imports'

export interface ErdFlowConfig {
  showPkAndFk: boolean
  showViews: boolean
  showAllColumns: boolean
  singleTableMode: boolean
  showJunctionTableNames: boolean
  showMMTables: boolean
}

interface Relation {
  source: string
  target: string
  childColId?: string
  parentColId?: string
  modelId?: string
  type: 'mm' | 'hm'
}

export function useErdElements(tables: MaybeRef<TableType[]>, props: MaybeRef<ErdFlowConfig>) {
  const elements = ref<Elements>([])

  const { theme } = useTheme()

  const colorScale = d3ScaleLinear<string>().domain([0, 2]).range([theme.value.primaryColor, theme.value.accentColor])

  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ rankdir: 'LR' })

  const { metasWithIdAsKey } = useMetas()

  const erdTables = computed(() => unref(tables))
  const config = $computed(() => unref(props))

  const relations = computed(() =>
    erdTables.value.reduce((acc, table) => {
      const meta = metasWithIdAsKey.value[table.id!]
      const columns =
        meta.columns?.filter((column: ColumnType) => column.uidt === UITypes.LinkToAnotherRecord && column.system !== 1) || []

      columns.forEach((column: ColumnType) => {
        const colOptions = column.colOptions as LinkToAnotherRecordType
        const source = column.fk_model_id
        const target = colOptions.fk_related_model_id

        const sourceExists = erdTables.value.find((t) => t.id === source)
        const targetExists = erdTables.value.find((t) => t.id === target)

        if (source && target && sourceExists && targetExists) {
          const relation: Relation = {
            source,
            target,
            childColId: colOptions.fk_child_column_id,
            parentColId: colOptions.fk_parent_column_id,
            modelId: colOptions.fk_mm_model_id,
            type: 'hm',
          }

          if (colOptions.type === 'hm') {
            relation.type = 'hm'

            return acc.push(relation)
          }

          if (colOptions.type === 'mm') {
            // Avoid duplicate mm connections
            const correspondingColumn = acc.find(
              (relation) =>
                relation.type === 'mm' &&
                relation.parentColId === colOptions.fk_child_column_id &&
                relation.childColId === colOptions.fk_parent_column_id,
            )

            if (!correspondingColumn) {
              relation.type = 'mm'

              return acc.push(relation)
            }
          }
        }
      })

      return acc
    }, [] as Relation[]),
  )

  const edgeMMTableLabel = (modelId?: string) => {
    if (!modelId) return ''

    const mmModel = metasWithIdAsKey.value[modelId]

    if (!mmModel) return ''

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
    return relations.value.reduce<Edge[]>((acc, { source, target, childColId, parentColId, type, modelId }) => {
      let sourceColumnId, targetColumnId
      let edgeLabel = ''

      if (type === 'hm') {
        sourceColumnId = childColId
        targetColumnId = childColId
      }

      if (type === 'mm') {
        sourceColumnId = parentColId
        targetColumnId = childColId
        edgeLabel = config.showJunctionTableNames ? edgeMMTableLabel(modelId) : ''
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
          isManyToMany: type === 'mm',
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
        dagreGraph.setNode(el.id, { width: 300, height: 35 + 50 * el.data.columnLength + 1 })
      } else if (isEdge(el)) {
        dagreGraph.setEdge(el.source, el.target)
      }
    })

    dagre.layout(dagreGraph)

    elements.value.forEach((el) => {
      if (isNode(el)) {
        const color = colorScale(dagreGraph.predecessors(el.id)!.length)

        const nodeWithPosition = dagreGraph.node(el.id)

        el.targetPosition = Position.Left
        el.sourcePosition = Position.Right
        el.position = { x: nodeWithPosition.x, y: nodeWithPosition.y }
        el.class = 'rounded-lg'
        el.data.color = color
        el.style = { boxShadow: `0 0 0 2px ${color}` }
      } else if (isEdge(el)) {
        const node = elements.value.find((nodes) => nodes.id === el.source)
        if (node) {
          el.style = { stroke: node.data.color }
        }
      }
    })
  }

  return {
    elements,
    layout,
  }
}
