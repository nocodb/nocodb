import type { Edge, Elements, Node } from '@vue-flow/core'
import { MarkerType, Position } from '@vue-flow/core'
import type { MaybeRef } from '@vueuse/core'
import { UITypes } from 'nocodb-sdk'
import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import type { ERDConfig, EdgeData, NodeData, Relation } from './types'
import { computed, ref, unref, useMetas, useProject, watch } from '#imports'

/**
 * This util is used to generate the ERD graph elements and layout them
 *
 * @param tables
 * @param props
 */
export function useErdElements(tables: MaybeRef<TableType[]>, props: MaybeRef<ERDConfig>) {
  const elements = ref<Elements<NodeData | EdgeData>>([])

  const { metasWithIdAsKey } = useMetas()

  const { project } = useProject()

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
      if (config.showJunctionTableNames) {
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
    return erdTables.value.reduce<Node<NodeData>[]>(
      (acc, table) => {
        if (!table.id) return acc

        const columns =
          metasWithIdAsKey.value[table.id].columns?.filter(
            (col) => config.showAllColumns || (!config.showAllColumns && col.uidt === UITypes.LinkToAnotherRecord),
          ) || []

        const pkAndFkColumns = columns.filter(() => config.showPkAndFk).filter((col) => col.pk || col.uidt === UITypes.ForeignKey)

        const nonPkColumns = columns.filter((col) => !col.pk && col.uidt !== UITypes.ForeignKey)

        acc.push({
          id: table.id,
          targetPosition: Position.Left,
          sourcePosition: Position.Right,
          class: 'rounded-lg',
          data: {
            table: metasWithIdAsKey.value[table.id],
            pkAndFkColumns,
            nonPkColumns,
            showPkAndFk: config.showPkAndFk,
            showAllColumns: config.showAllColumns,
            columnLength: columns.length,
            color: '',
            depth: 0,
          },
          type: 'custom',
          position: { x: 0, y: 0 },
        })

        return acc
      },
      [
        {
          id: project.value.id!.toString(),
          class: 'hidden w-0 h-0',
          label: project.value.title,
          position: { x: 0, y: 0 },
          width: 0,
          height: 0,
        },
      ],
    )
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

  const createElements = () => {
    elements.value = [...createNodes(), ...createEdges()] as Elements<NodeData | EdgeData>
    return elements.value
  }

  watch(
    erdTables,
    () => {
      createElements()
    },
    { immediate: true },
  )

  return {
    elements,
    createElements,
  }
}
