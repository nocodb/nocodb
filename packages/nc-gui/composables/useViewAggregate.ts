import type { Ref } from 'vue'
import {
  type ColumnType,
  CommonAggregations,
  type TableType,
  UITypes,
  type ViewType,
  ViewTypes,
  getAvailableAggregations,
} from 'nocodb-sdk'

const [useProvideViewAggregate, useViewAggregate] = useInjectionState(
  (
    view: Ref<ViewType | undefined>,
    meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>,
    where?: ComputedRef<string | undefined>,
  ) => {
    const { $api: api } = useNuxtApp()

    const fields = inject(FieldsInj, ref([]))

    const isPublic = inject(IsPublicInj, ref(false))

    const { gridViewCols, updateGridViewColumn } = useViewColumnsOrThrow()

    const { nestedFilters } = useSmartsheetStoreOrThrow()

    const { isUIAllowed } = useRoles()

    const { fetchAggregatedData } = useSharedView()

    const aggregations = ref({}) as Ref<Record<string, any>>

    const reloadAggregate = inject(ReloadAggregateHookInj)

    const visibleFieldsComputed = computed(() => {
      const field = fields.value.map((field, index) => ({ field, index })).filter((f) => f.index !== 0)

      return field.map((f) => {
        const gridField = gridViewCols.value[f.field.id!]

        if (!gridField) {
          return { field: null, index: f.index }
        }

        return {
          value: aggregations.value[f.field.title!] ?? null,
          field: gridField,
          column: f.field,
          index: f.index,
          width: `${Number((gridField.width ?? '').replace('px', ''))}px` || '180px',
        }
      })
    })

    const displayFieldComputed = computed(() => {
      if (!fields.value?.length || !gridViewCols.value)
        return {
          field: null,
          width: '180px',
        }

      return {
        value: aggregations.value[fields.value[0].title] ?? null,
        column: fields.value[0],
        field: gridViewCols.value[fields.value[0].id!],
        width: `${Number((gridViewCols.value[fields.value[0]!.id!].width ?? '').replace('px', '')) + 64}px` || '244px',
      }
    })

    const getAggregations = (column: ColumnType) => {
      if (column.uidt === UITypes.Formula && (column.colOptions as any)?.parsed_tree?.dataType) {
        return getAvailableAggregations(column.uidt!, (column.colOptions as any).parsed_tree)
      }
      return getAvailableAggregations(column.uidt!)
    }

    const loadViewAggregate = async (
      fields?: Array<{
        field: string
        type: string
      }>,
    ) => {
      // Wait for meta to be defined https://vueuse.org/shared/until/
      await until(() => !!meta.value)
        .toBeTruthy({
          timeout: 10000,
        })
        .then(async () => {
          if (!view.value?.type || view.value?.type !== ViewTypes.GRID) return

          try {
            const data = !isPublic.value
              ? await api.dbDataTableAggregate.dbDataTableAggregate(meta.value.id, {
                  viewId: view.value.id,
                  where: where?.value,
                  ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
                  ...(fields ? { aggregation: fields } : {}),
                })
              : await fetchAggregatedData({
                  where: where?.value,
                  filtersArr: nestedFilters.value,
                  ...(fields ? { aggregation: fields } : {}),
                })

            Object.assign(aggregations.value, data)
          } catch (error) {
            console.log(error)
            message.error(await extractSdkResponseErrorMsgv2(error as any))
          }
        })
    }

    const updateAggregate = async (fieldId: string, agg: string) => {
      await reloadAggregate?.trigger({
        fields: [
          {
            title: fields.value.find((f) => f.id === fieldId)?.title ?? '',
            aggregation: agg,
          },
        ],
      })
      await updateGridViewColumn(fieldId, { aggregation: agg })
    }

    reloadAggregate?.on(async (_fields) => {
      if (!_fields || !_fields?.fields.length) {
        await loadViewAggregate()
      }
      if (_fields?.fields) {
        const fieldAggregateMapping = _fields.fields.reduce((acc, field) => {
          const f = fields.value.find((f) => f.title === field.title)

          if (!f?.id) return acc

          acc[f.id] = field.aggregation ?? gridViewCols.value[f.id].aggregation ?? CommonAggregations.None

          return acc
        }, {} as Record<string, string>)

        await loadViewAggregate(
          Object.entries(fieldAggregateMapping).map(([field, type]) => ({
            field,
            type,
          })),
        )
      }
    })

    return {
      loadViewAggregate,
      isPublic,
      updateAggregate,
      getAggregations,
      displayFieldComputed,
      visibleFieldsComputed,
    }
  },
)

export { useProvideViewAggregate }

export function useViewAggregateOrThrow() {
  const viewAggregate = useViewAggregate()
  if (viewAggregate == null) throw new Error('Please call `useProvideViewAggregate` on the appropriate parent component')
  return viewAggregate
}
