import type { Ref } from 'vue'
import {
  type ColumnType,
  CommonAggregations,
  type FormulaType,
  type TableType,
  UITypes,
  type ViewType,
  ViewTypes,
  getAvailableAggregations,
  getRollupResultUidt,
  isVirtualCol,
} from 'nocodb-sdk'
import type { EventHook } from '@vueuse/core'
import { isPeerChangeAffectingAggregates } from '~/utils/realtimeUtils'

const [useProvideViewAggregate, useViewAggregate] = useInjectionState(
  (
    view: Ref<ViewType | undefined>,
    meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>,
    where?: ComputedRef<string | undefined>,
    reloadVisibleDataHook?: EventHook<void>,
  ) => {
    const { $eventBus } = useNuxtApp()

    const { internalGet } = useInternalBatch()

    const fields = inject(FieldsInj, ref([]))

    const isPublic = inject(IsPublicInj, ref(false))

    const interfaceDataApi = inject(InterfacePageDataInj, undefined)

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
        width: `${Number((gridViewCols.value[fields.value[0]!.id!].width ?? '').replace('px', '')) + 80}px` || '260px',
      }
    })

    const getAggregations = (column: ColumnType) => {
      if (column.uidt === UITypes.Formula && (column.colOptions as any)?.parsed_tree?.dataType) {
        return getAvailableAggregations(column.uidt!, (column.colOptions as any).parsed_tree)
      }
      return getAvailableAggregations(column.uidt!, undefined, getRollupResultUidt(column))
    }

    // `silent`: a refresh nobody asked for (a peer's change) fails without a toast
    const loadViewAggregate = async (
      fields?: Array<{
        field: string
        type: string
      }>,
      { silent = false }: { silent?: boolean } = {},
    ) => {
      // Interface pages: aggregations flow through the adapter — always with
      // explicit (field, type) pairs since the synthetic view stores none
      // SERVER-side. A no-args call (canvas mount / generic reload) derives
      // the pairs from the hydrated columns — the same derivation the
      // group-header path uses — else the footer summary never loads while
      // per-group summaries do.
      if (interfaceDataApi) {
        if (!interfaceDataApi.fetchAggregate) return

        const requested =
          fields ??
          Object.values(gridViewCols.value)
            .map((f) => ({ field: f.fk_column_id!, type: f.aggregation ?? CommonAggregations.None }))
            .filter((f) => f.type !== CommonAggregations.None)

        if (!requested.length) return

        try {
          const data = await interfaceDataApi.fetchAggregate({
            aggregation: requested,
            where: where?.value,
            filtersArr: nestedFilters.value,
          })

          Object.assign(aggregations.value, data)
          reloadVisibleDataHook?.trigger()
        } catch (error) {
          console.error(error)
          message.error(await extractSdkResponseErrorMsgv2(error as any))
        }
        return
      }

      // Wait for meta to be defined https://vueuse.org/shared/until/
      await until(() => !!meta.value)
        .toBeTruthy({
          timeout: 10000,
        })
        .then(async () => {
          if (!view.value?.type || view.value?.type !== ViewTypes.GRID) return

          try {
            const data = !isPublic.value
              ? await internalGet(meta.value.fk_workspace_id!, meta.value.base_id!, {
                  operation: 'dataAggregate',
                  tableId: meta.value.id,
                  viewId: view.value.id,
                  baseId: meta.value.base_id!,
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
            reloadVisibleDataHook?.trigger()
          } catch (error) {
            console.log(error)
            if (!silent) message.error(await extractSdkResponseErrorMsgv2(error as any))
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
      if (interfaceDataApi) {
        // Synthetic interface view — the local assign keeps the footer
        // instant; builders additionally persist the pick into the viz config
        // (`field_configs[id].aggregation`) so it survives reloads and rides
        // the published snapshot. Consumers have no callback: picks stay
        // session-local.
        if (gridViewCols.value?.[fieldId]) Object.assign(gridViewCols.value[fieldId], { aggregation: agg })
        interfaceDataApi.setFieldAggregation?.(fieldId, agg)
      } else {
        await updateGridViewColumn(fieldId, { aggregation: agg })
      }
      reloadVisibleDataHook?.trigger()
    }

    const aggregateFormulaFields = computed(() => {
      return fields.value
        .filter((field) => {
          if (!field?.id || !field?.title) return false

          if (
            !isFormula(field) ||
            !gridViewCols.value[field.id] ||
            !gridViewCols.value[field.id]?.aggregation ||
            gridViewCols.value[field.id]?.aggregation === CommonAggregations.None ||
            !(field.colOptions as FormulaType)?.formula_raw
          ) {
            return false
          }

          return true
        })
        .map((field) => {
          return {
            id: field.id,
            aggregation: gridViewCols.value[field.id!]?.aggregation ?? CommonAggregations.None,
            formula_raw: (field.colOptions as FormulaType)?.formula_raw ?? '',
          }
        })
    })

    const reloadAggregateListener = async (_fields: any) => {
      if (!_fields || !_fields?.fields?.length) {
        await loadViewAggregate()
      }
      if (_fields?.fields) {
        const fieldAggregateMapping = _fields.fields.reduce((acc, field) => {
          const f = fields.value.find((f) => f.title === field.title)

          if (!f?.id) return acc

          acc[f.id] = field.aggregation ?? gridViewCols.value[f.id].aggregation ?? CommonAggregations.None

          for (const formulaField of aggregateFormulaFields.value) {
            if (!acc[formulaField.id!] && formulaField.formula_raw.includes(field.title)) {
              acc[formulaField.id!] = formulaField.aggregation
            }
          }

          return acc
        }, {} as Record<string, string>)

        await loadViewAggregate(
          Object.entries(fieldAggregateMapping).map(([field, type]) => ({
            field,
            type: type as string,
          })),
        )
      }
    }

    reloadAggregate?.on(reloadAggregateListener)

    const hasFooterAggregations = () =>
      Object.values(gridViewCols.value).some((col) => col.aggregation && col.aggregation !== CommonAggregations.None)

    // A peer's row events arrive in bursts; one footer reload covers them.
    // A peer's row events arrive in bursts, and on every client at once: one reload per burst, spread per client.
    const peerJitterMs = Math.random() * 1500
    const reloadAggregateForPeers = useDebounceFn(() => loadViewAggregate(undefined, { silent: true }), 1000 + peerJitterMs, {
      maxWait: 5000 + peerJitterMs,
    })

    const peerChangeAffectsAggregates = (changedFields?: string[]) =>
      isPeerChangeAffectingAggregates(
        changedFields,
        (fields.value ?? [])
          .filter((field) => {
            const aggregation = field.id ? gridViewCols.value[field.id]?.aggregation : undefined
            return !!aggregation && aggregation !== CommonAggregations.None
          })
          .map((field) => ({ title: field.title, isComputed: isVirtualCol(field) })),
      )

    const aggregationReloadListener = (
      event: SmartsheetStoreEvents,
      payload?: { tableId?: string; peer?: boolean; changedFields?: string[] },
    ) => {
      if (event !== SmartsheetStoreEvents.AGGREGATION_RELOAD) return
      if (!payload?.peer) return loadViewAggregate()
      if (payload.tableId === meta.value?.id && hasFooterAggregations() && peerChangeAffectsAggregates(payload.changedFields))
        reloadAggregateForPeers()
    }
    $eventBus.smartsheetStoreEventBus.on(aggregationReloadListener)

    onBeforeUnmount(() => {
      reloadAggregate?.off(reloadAggregateListener)
      $eventBus.smartsheetStoreEventBus.off(aggregationReloadListener)
    })

    return {
      loadViewAggregate,
      isPublic,
      aggregations,
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
