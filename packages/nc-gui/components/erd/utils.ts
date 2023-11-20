import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { UITypes, isLinksOrLTAR } from 'nocodb-sdk'
import dagre from 'dagre'
import type { Edge, EdgeMarker, Elements, Node } from '@vue-flow/core'
import type { MaybeRef } from '@vueuse/core'
import { MarkerType, Position, isEdge, isNode } from '@vue-flow/core'
import { scaleLinear as d3ScaleLinear } from 'd3-scale'
import tinycolor from 'tinycolor2'
import { computed, ref, unref, useMetas, useTheme } from '#imports'

export interface ERDConfig {
  showPkAndFk: boolean
  showViews: boolean
  showAllColumns: boolean
  singleTableMode: boolean
  showJunctionTableNames: boolean
  showMMTables: boolean
  isFullScreen: boolean
}

export interface NodeData {
  table: TableType
  pkAndFkColumns: ColumnType[]
  nonPkColumns: ColumnType[]
  showPkAndFk: boolean
  showAllColumns: boolean
  color: string
  columnLength: number
}

export interface EdgeData {
  isManyToMany: boolean
  isSelfRelation: boolean
  label?: string
  simpleLabel?: string
  color: string
}

interface Relation {
  source: string
  target: string
  childColId?: string
  parentColId?: string
  modelId?: string
  type: 'mm' | 'hm'
}

/**
 * This util is used to generate the ERD graph elements and layout them
 *
 * @param tables
 * @param props
 */
export function useErdElements(tables: MaybeRef<TableType[]>, props: MaybeRef<ERDConfig>) {
  const elements = ref<Elements<NodeData | EdgeData>>([])

  const { theme } = useTheme()

  const colorScale = d3ScaleLinear<string>().domain([0, 2]).range([theme.value.primaryColor, theme.value.accentColor])

  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ rankdir: 'LR' })

  const { metasWithIdAsKey } = useMetas()

  const erdTables = computed(() => unref(tables))
  const config = computed(() => unref(props))

  const nodeWidth = 300
  const nodeHeight = computed(() => (config.value.showViews && config.value.showAllColumns ? 50 : 40))

  const relations = computed(() =>
    erdTables.value.reduce((acc, table) => {
      const meta = metasWithIdAsKey.value[table.id!]
      const columns = meta.columns?.filter((column: ColumnType) => isLinksOrLTAR(column) && column.system !== 1) || []

      for (const column of columns) {
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

            acc.push(relation)
            continue
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

              acc.push(relation)
              continue
            }
          }
        }
      }

      return acc
    }, [] as Relation[]),
  )

  function edgeLabel({ type, source, target, modelId, childColId, parentColId }: Relation) {
    const typeLabel = type === 'mm' ? 'many to many' : 'has many'

    const parentCol = metasWithIdAsKey.value[source].columns?.find((col) => {
      const colOptions = col.colOptions as LinkToAnotherRecordType
      if (!colOptions) return false

      return (
        colOptions.fk_child_column_id === childColId &&
        colOptions.fk_parent_column_id === parentColId &&
        colOptions.fk_mm_model_id === modelId
      )
    })

    const childCol = metasWithIdAsKey.value[target].columns?.find((col) => {
      const colOptions = col.colOptions as LinkToAnotherRecordType
      if (!colOptions) return false

      return colOptions.fk_parent_column_id === (type === 'mm' ? childColId : parentColId)
    })

    if (!parentCol || !childCol) return ''

    if (type === 'mm') {
      if (config.value.showJunctionTableNames) {
        if (!modelId) return ''

        const mmModel = metasWithIdAsKey.value[modelId]

        if (!mmModel) return ''

        if (mmModel.title !== mmModel.table_name) {
          return [`${mmModel.title} (${mmModel.table_name})`]
        }

        return [mmModel.title]
      }
    }

    return [
      // detailed edge label
      `[${metasWithIdAsKey.value[source].title}] ${parentCol.title} - ${typeLabel} - ${childCol.title} [${metasWithIdAsKey.value[target].title}]`,
      // simple edge label (for skeleton)
      `${metasWithIdAsKey.value[source].title} - ${typeLabel} - ${metasWithIdAsKey.value[target].title}`,
    ]
  }

  function createNodes() {
    return erdTables.value.reduce<Node<NodeData>[]>((acc, table) => {
      if (!table.id) return acc

      const columns =
        metasWithIdAsKey.value[table.id].columns?.filter(
          (col) => config.value.showAllColumns || (!config.value.showAllColumns && isLinksOrLTAR(col)),
        ) || []

      const pkAndFkColumns = columns
        .filter(() => config.value.showPkAndFk)
        .filter((col) => col.pk || col.uidt === UITypes.ForeignKey)

      const nonPkColumns = columns.filter((col) => !col.pk && col.uidt !== UITypes.ForeignKey)

      acc.push({
        id: table.id,
        data: {
          table: metasWithIdAsKey.value[table.id],
          pkAndFkColumns,
          nonPkColumns,
          showPkAndFk: config.value.showPkAndFk,
          showAllColumns: config.value.showAllColumns,
          columnLength: columns.length,
          color: '',
        },
        type: 'custom',
        position: { x: 0, y: 0 },
      })

      return acc
    }, [])
  }

  function createEdges() {
    return relations.value.reduce<Edge<EdgeData>[]>((acc, { source, target, childColId, parentColId, type, modelId }) => {
      let sourceColumnId, targetColumnId

      if (type === 'hm') {
        sourceColumnId = childColId
        targetColumnId = childColId
      }

      if (type === 'mm') {
        sourceColumnId = parentColId
        targetColumnId = childColId
      }

      const [label, simpleLabel] = edgeLabel({
        source,
        target,
        type,
        childColId,
        parentColId,
        modelId,
      })

      acc.push({
        id: `e-${sourceColumnId}-${source}-${targetColumnId}-${target}-#${label}`,
        source: `${source}`,
        target: `${target}`,
        sourceHandle: `s-${sourceColumnId}-${source}`,
        targetHandle: `d-${targetColumnId}-${target}`,
        type: 'custom',
        markerEnd: {
          id: 'arrow-colored',
          type: MarkerType.ArrowClosed,
        },
        data: {
          isManyToMany: type === 'mm',
          isSelfRelation: source === target && sourceColumnId === targetColumnId,
          label,
          simpleLabel,
          color: '',
        },
      })

      return acc
    }, [])
  }

  const boxShadow = (_skeleton: boolean, _color: string) => ({})

  const layout = async (skeleton = false): Promise<void> => {
    return new Promise((resolve) => {
      elements.value = [...createNodes(), ...createEdges()] as Elements<NodeData | EdgeData>

      for (const el of elements.value) {
        if (isNode(el)) {
          const node = el as Node<NodeData>
          const colLength = node.data!.columnLength

          const width = skeleton ? nodeWidth * 3 : nodeWidth
          const height = nodeHeight.value + (skeleton ? 250 : colLength > 0 ? nodeHeight.value * colLength : nodeHeight.value)
          dagreGraph.setNode(el.id, {
            width,
            height,
          })
        } else if (isEdge(el)) {
          dagreGraph.setEdge(el.source, el.target)
        }
      }

      dagre.layout(dagreGraph)

      for (const el of elements.value) {
        if (isNode(el)) {
          const color = colorScale(dagreGraph.predecessors(el.id)!.length)

          const nodeWithPosition = dagreGraph.node(el.id)

          el.targetPosition = Position.Left
          el.sourcePosition = Position.Right
          el.position = { x: nodeWithPosition.x, y: nodeWithPosition.y }
          el.class = ['rounded-lg border-1 border-gray-200 shadow-lg'].join(' ')
          el.data.color = color

          el.style = (n) => {
            if (n.selected) {
              return boxShadow(skeleton, color)
            }

            return boxShadow(skeleton, '#64748B')
          }
        } else if (isEdge(el)) {
          const node = elements.value.find((nodes) => nodes.id === el.source)
          if (node) {
            const color = node.data!.color

            el.data.color = color
            ;(el.markerEnd as EdgeMarker).color = `#${tinycolor(color).toHex()}`
          }
        }
      }

      resolve()
    })
  }

  return {
    elements,
    layout,
  }
}
