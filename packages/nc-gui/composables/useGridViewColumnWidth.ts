import type { ColumnType, GridColumnType, ViewType } from 'nocodb-sdk'
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

export function useGridViewColumnWidth(view: Ref<ViewType | undefined>) {
  const { css, load: loadCss, unload: unloadCss } = useStyleTag('')

  const { isUIAllowed } = useUIPermission()

  const { $api } = useNuxtApp()

  const { metas } = useMetas()

  const { addUndo } = useUndoRedo()

  const gridViewCols = ref<Record<string, GridColumnType>>({})
  const resizingCol = ref('')
  const resizingColWidth = ref('200px')
  const isPublic = inject(IsPublicInj, ref(false))

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

    const colsData: GridColumnType[] = (isPublic.value ? columns.value : await $api.dbView.gridColumnsList(view.value!.id!)) ?? []
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
  watch([() => columns.value?.length, () => view?.value?.id], loadGridViewColumns)

  const updateWidth = async (id: string, width: string, undo = false) => {
    if (!undo) {
      addUndo({
        redo: {
          fn: (w: string) => updateWidth(id, w, true),
          args: [width],
        },
        undo: {
          fn: (w: string) => updateWidth(id, w, true),
          args: [gridViewCols.value[id].width],
        },
        scope: view.value?.is_default ? [view.value.fk_model_id, view.value.title] : view.value?.title,
      })
    }

    if (gridViewCols?.value?.[id]) {
      gridViewCols.value[id].width = width
    }

    // sync with server if allowed
    if (!isPublic.value && isUIAllowed('gridColUpdate') && gridViewCols.value[id]?.id) {
      await $api.dbView.gridColumnUpdate(gridViewCols.value[id].id as string, {
        width,
      })
    }
  }

  return { loadGridViewColumns, updateWidth, resizingCol, resizingColWidth, loadCss, unloadCss }
}
