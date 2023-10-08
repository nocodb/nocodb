import type { ColumnType, GridColumnReqType, GridColumnType, ViewType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { IsPublicInj, computed, inject, ref, useMetas, useNuxtApp, useRoles, useUndoRedo, watch } from '#imports'

const [useProvideGridViewColumn, useGridViewColumn] = useInjectionState(
  (view: Ref<(ViewType & { columns?: GridColumnType[] }) | undefined>, statePublic = false) => {
    const { isUIAllowed } = useRoles()

    const { $api } = useNuxtApp()

    const { metas } = useMetas()

    const { addUndo, defineViewScope } = useUndoRedo()

    const gridViewCols = ref<Record<string, GridColumnType>>({})
    const resizingColOldWith = ref('200px')
    const isPublic = inject(IsPublicInj, ref(statePublic))

    const columns = computed<ColumnType[]>(() => metas.value?.[view.value?.fk_model_id as string]?.columns || [])

    const loadGridViewColumns = async () => {
      if (!view.value?.id && !isPublic.value) return

      const colsData: GridColumnType[] =
        (isPublic.value ? view.value?.columns : await $api.dbView.gridColumnsList(view.value!.id!)) ?? []

      gridViewCols.value = colsData.reduce<Record<string, GridColumnType>>(
        (o, col) => ({
          ...o,
          [col.fk_column_id as string]: col,
        }),
        {},
      )
    }

    /** when columns changes(create/delete) reload grid columns
     * or when view changes reload columns width  */
    watch(
      [() => columns.value?.length, () => view.value?.id],
      async (n) => {
        if (n[1]) await loadGridViewColumns()
      },
      { immediate: true },
    )

    const updateGridViewColumn = async (id: string, props: Partial<GridColumnReqType>, undo = false) => {
      if (!undo) {
        const oldProps = Object.keys(props).reduce<Partial<GridColumnReqType>>((o: any, k) => {
          if (gridViewCols.value[id][k as keyof GridColumnType]) {
            if (k === 'width') o[k] = `${resizingColOldWith.value}px`
            else o[k] = gridViewCols.value[id][k as keyof GridColumnType]
          }
          return o
        }, {})
        addUndo({
          redo: {
            fn: (w: Partial<GridColumnReqType>) => updateGridViewColumn(id, w, true),
            args: [props],
          },
          undo: {
            fn: (w: Partial<GridColumnReqType>) => updateGridViewColumn(id, w, true),
            args: [oldProps],
          },
          scope: defineViewScope({ view: view.value }),
        })
      }

      // sync with server if allowed
      if (!isPublic.value && isUIAllowed('viewFieldEdit') && gridViewCols.value[id]?.id) {
        await $api.dbView.gridColumnUpdate(gridViewCols.value[id].id as string, {
          ...props,
        })
      }

      if (gridViewCols.value?.[id]) {
        Object.assign(gridViewCols.value[id], {
          ...gridViewCols.value[id],
          ...props,
        })
      } else {
        // fallback to reload
        await loadGridViewColumns()
      }
    }

    return { loadGridViewColumns, updateGridViewColumn, gridViewCols, resizingColOldWith }
  },
  'useGridViewColumn',
)

export { useProvideGridViewColumn }

export function useGridViewColumnOrThrow() {
  const gridViewColumn = useGridViewColumn()
  if (gridViewColumn == null) throw new Error('Please call `useProvideGridViewColumn` on the appropriate parent component')
  return gridViewColumn
}
