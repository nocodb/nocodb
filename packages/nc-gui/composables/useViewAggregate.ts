import type { Ref } from 'vue'
import { type TableType, type ViewType, getAvailableAggregations } from 'nocodb-sdk'

const [useProvideViewAggregate, useViewAggregate] = useInjectionState(
  (
    view: Ref<ViewType | undefined>,
    meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>,
    where?: ComputedRef<string | undefined>,
    isPublic = false,
  ) => {
    const { $api: api } = useNuxtApp()

    const fields = inject(FieldsInj, ref([]))

    const { gridViewCols, updateGridViewColumn } = useViewColumnsOrThrow()

    const aggregations = ref({}) as Ref<Record<string, any>>

    const visibleFieldsComputed = computed(() => {
      const fie = fields.value.map((field, index) => ({ field, index })).filter((f) => f.index !== 0)

      return fie.map((f) => {
        const gridField = gridViewCols.value[f.field.id!]

        if (!gridField) {
          return { field: null, index: f.index }
        }

        return {
          value: aggregations.value[f.field.title] ?? null,
          field: gridField,
          column: f.field,
          index: f.index,
          width: `${Number(gridField.width.replace('px', ''))}px` || '180px',
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
        width: `${Number((gridViewCols.value[fields.value[0]!.id!].width ?? '').replace('px', ''))}px` || '180px',
      }
    })

    const getAggregations = (type: string, hideNone?: boolean) => {
      const agg = getAvailableAggregations(type)
      if (hideNone) {
        return agg.filter((x) => x !== 'none')
      }
      return agg
    }

    const loadViewAggregate = async () => {
      if (!meta.value?.id || !view.value?.id) return

      try {
        const data = await api.dbDataTableAggregate.dbDataTableAggregate(
          meta.value.id,
          {
            viewId: view.value.id,
            where: where?.value,
          },
          {},
        )

        aggregations.value = data
      } catch (error) {
        console.log(error)
      }
    }

    const updateAggregate = async (fieldId: string, agg: string) => {
      await updateGridViewColumn(fieldId, { aggregation: agg })
      await loadViewAggregate()
    }

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
