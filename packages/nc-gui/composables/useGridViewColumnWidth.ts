import { useStyleTag } from '@vueuse/core'
import type { ColumnType, GridColumnType, GridType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { useMetas } from './useMetas'
import { useUIPermission } from './useUIPermission'
import { IsPublicInj } from '~/context'

export function useGridViewColumnWidth(view: Ref<GridType | undefined>) {
  const { css, load: loadCss, unload: unloadCss } = useStyleTag('')
  const { isUIAllowed } = useUIPermission()
  const { $api } = useNuxtApp()
  const { metas } = useMetas()

  const gridViewCols = ref<Record<string, GridColumnType>>({})
  const resizingCol = ref('')
  const resizingColWidth = ref('200px')
  const isPublic = inject(IsPublicInj, ref(false))

  const columns = computed<ColumnType[]>(() => metas?.value?.[(view.value as any)?.fk_model_id as string]?.columns)

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
    if ((!view.value || view.value?.id) && !isPublic.value) return

    const colsData: GridColumnType[] = isPublic.value ? columns.value : await $api.dbView.gridColumnsList(view.value!.id!)
    gridViewCols.value = colsData.reduce<Record<string, GridColumnType>>(
      (o, col) => ({
        ...o,
        [col.fk_column_id as string]: col,
      }),
      {},
    )
    loadCss()
  }

  /** when columns changes(create/delete) reload grid columns */
  watch(columns, loadGridViewColumns)

  const updateWidth = (id: string, width: string) => {
    if (gridViewCols?.value?.[id]) {
      gridViewCols.value[id].width = width
    }

    // sync with server if allowed
    if (!isPublic.value && isUIAllowed('gridColUpdate') && gridViewCols.value[id]?.id) {
      $api.dbView.gridColumnUpdate(gridViewCols.value[id].id as string, {
        width,
      })
    }
  }

  return { loadGridViewColumns, updateWidth, resizingCol, resizingColWidth, loadCss, unloadCss }
}
