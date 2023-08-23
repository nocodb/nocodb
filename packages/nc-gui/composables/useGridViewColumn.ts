import type { ColumnType, GridColumnReqType, GridColumnType, ViewType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import {
  IsPublicInj,
  computed,
  inject,
  ref,
  useMetas,
  useNuxtApp,
  useStyleTag,
  useUIPermission,
  useUndoRedo,
  watch,
} from '#imports'

const [useProvideGridViewColumn, useGridViewColumn] = useInjectionState(
  (view: Ref<(ViewType & { columns?: GridColumnType[] }) | undefined>, statePublic = false) => {
    const { css, load: loadCss, unload: unloadCss } = useStyleTag('')

    const { isUIAllowed } = useUIPermission()

    const { $api } = useNuxtApp()

    const { metas } = useMetas()

    const { addUndo, defineViewScope } = useUndoRedo()

    const gridViewCols = ref<Record<string, GridColumnType>>({})
    const resizingCol = ref<string | null>('')
    const resizingColWidth = ref('200px')
    const isPublic = inject(IsPublicInj, ref(statePublic))

    const columns = computed<ColumnType[]>(() => metas.value?.[view.value?.fk_model_id as string]?.columns || [])

    watch(
      [gridViewCols, resizingCol, resizingColWidth],
      () => {
        let style = ''
        for (const c of columns?.value || []) {
          const val = gridViewCols?.value?.[c?.id as string]?.width || '200px'

          if (val && c.title !== resizingCol?.value) {
            style += `[data-col="${c.id}"]{min-width:${val};max-width:${val};width: ${val};}`
          } else {
            style += `[data-col="${c.id}"]{min-width:${resizingColWidth?.value};max-width:${resizingColWidth?.value};width: ${resizingColWidth?.value};}`
          }
        }
        css.value = style
      },
      { deep: true, immediate: true },
    )

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

      loadCss()
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
            o[k] = gridViewCols.value[id][k as keyof GridColumnType]
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
      if (!isPublic.value && isUIAllowed('gridColUpdate') && gridViewCols.value[id]?.id) {
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

    return { loadGridViewColumns, updateGridViewColumn, resizingCol, resizingColWidth, gridViewCols, loadCss, unloadCss }
  },
  'useGridViewColumn',
)

export { useProvideGridViewColumn }

export function useGridViewColumnOrThrow() {
  const gridViewColumn = useGridViewColumn()
  if (gridViewColumn == null) throw new Error('Please call `useProvideGridViewColumn` on the appropriate parent component')
  return gridViewColumn
}
