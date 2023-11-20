import { ViewTypes, isSystemColumn } from 'nocodb-sdk'
import type { ColumnType, GridColumnReqType, GridColumnType, MapType, TableType, ViewType } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import { computed, ref, storeToRefs, useBase, useNuxtApp, useRoles, useUndoRedo, watch } from '#imports'
import type { Field } from '#imports'

const [useProvideViewColumns, useViewColumns] = useInjectionState(
  (
    view: Ref<ViewType | undefined>,
    meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>,
    reloadData?: () => void,
    isPublic = false,
  ) => {
    const fields = ref<Field[]>()

    const filterQuery = ref('')

    const { $api, $e } = useNuxtApp()

    const { isUIAllowed } = useRoles()

    const { isSharedBase } = storeToRefs(useBase())

    const isViewColumnsLoading = ref(false)

    const { addUndo, defineViewScope } = useUndoRedo()

    const isLocalMode = computed(
      () => isPublic || !isUIAllowed('viewFieldEdit') || !isUIAllowed('viewFieldEdit') || isSharedBase.value,
    )

    const localChanges = ref<Field[]>([])

    const isColumnViewEssential = (column: ColumnType) => {
      // TODO: consider at some point ti delegate this via a cleaner design pattern to view specific check logic
      // which could be inside of a view specific helper class (and generalized via an interface)
      // (on the other hand, the logic complexity is still very low atm - might be overkill)
      return view.value?.type === ViewTypes.MAP && (view.value?.view as MapType)?.fk_geo_data_col_id === column.id
    }

    const metaColumnById = computed<Record<string, ColumnType>>(() => {
      if (!meta.value?.columns) return {}

      return (meta.value.columns as ColumnType[]).reduce(
        (acc, curr) => ({
          ...acc,
          [curr.id!]: curr,
        }),
        {},
      ) as Record<string, ColumnType>
    })

    const gridViewCols = ref<Record<string, GridColumnType>>({})

    const loadViewColumns = async () => {
      if (!meta || !view) return

      let order = 1

      if (view.value?.id) {
        const data = (isPublic ? meta.value?.columns : (await $api.dbViewColumn.list(view.value.id)).list) as any[]

        const fieldById = data.reduce<Record<string, any>>((acc, curr) => {
          curr.show = !!curr.show

          return {
            ...acc,
            [curr.fk_column_id]: curr,
          }
        }, {})

        fields.value = meta.value?.columns
          ?.map((column: ColumnType) => {
            const currentColumnField = fieldById[column.id!] || {}

            return {
              title: column.title,
              fk_column_id: column.id,
              ...currentColumnField,
              show: currentColumnField.show || isColumnViewEssential(currentColumnField),
              order: currentColumnField.order || order++,
              system: isSystemColumn(metaColumnById?.value?.[currentColumnField.fk_column_id!]),
              isViewEssentialField: isColumnViewEssential(column),
            }
          })
          .sort((a: Field, b: Field) => a.order - b.order)

        if (isLocalMode.value && fields.value) {
          for (const field of localChanges.value) {
            const fieldIndex = fields.value.findIndex((f) => f.fk_column_id === field.fk_column_id)
            if (fieldIndex !== undefined && fieldIndex > -1) {
              fields.value[fieldIndex] = field
              fields.value = fields.value.sort((a: Field, b: Field) => a.order - b.order)
            }
          }
        }

        const colsData: GridColumnType[] = (isPublic.value ? view.value?.columns : fields.value) ?? []

        gridViewCols.value = colsData.reduce<Record<string, GridColumnType>>(
          (o, col) => ({
            ...o,
            [col.fk_column_id as string]: col,
          }),
          {},
        )
      }
    }

    const showAll = async (ignoreIds?: any) => {
      if (isLocalMode.value) {
        fields.value = fields.value?.map((field: Field) => ({
          ...field,
          show: true,
        }))
        reloadData?.()
        return
      }

      if (view?.value?.id) {
        if (ignoreIds) {
          await $api.dbView.showAllColumn(view.value.id, {
            ignoreIds,
          })
        } else {
          await $api.dbView.showAllColumn(view.value.id)
        }
      }

      await loadViewColumns()
      reloadData?.()
      $e('a:fields:show-all')
    }
    const hideAll = async (ignoreIds?: any) => {
      if (isLocalMode.value) {
        fields.value = fields.value?.map((field: Field) => ({
          ...field,
          show: !!field.isViewEssentialField,
        }))
        reloadData?.()
        return
      }
      if (view?.value?.id) {
        if (ignoreIds) {
          await $api.dbView.hideAllColumn(view.value.id, {
            ignoreIds,
          })
        } else {
          await $api.dbView.hideAllColumn(view.value.id)
        }
      }

      await loadViewColumns()
      reloadData?.()
      $e('a:fields:show-all')
    }

    const saveOrUpdate = async (field: any, index: number, disableDataReload: boolean = false) => {
      if (isLocalMode.value && fields.value) {
        fields.value[index] = field
        meta.value!.columns = meta.value!.columns?.map((column: ColumnType) => {
          if (column.id === field.fk_column_id) {
            return {
              ...column,
              ...field,
              id: field.fk_column_id,
            }
          }
          return column
        })

        localChanges.value.push(field)
      }

      if (isUIAllowed('viewFieldEdit')) {
        if (field.id && view?.value?.id) {
          await $api.dbViewColumn.update(view.value.id, field.id, field)
        } else if (view.value?.id) {
          const insertedField = (await $api.dbViewColumn.create(view.value.id, field)) as any

          /** update the field in fields if defined */
          if (fields.value) fields.value[index] = insertedField

          return insertedField
        }
      }

      if (!disableDataReload) {
        await loadViewColumns()
        reloadData?.()
      }
    }

    const showSystemFields = computed({
      get() {
        return (view.value?.show_system_fields as boolean) || false
      },
      set(v: boolean) {
        if (view?.value?.id) {
          if (!isLocalMode.value) {
            $api.dbView
              .update(view.value.id, {
                show_system_fields: v,
              })
              .finally(() => {
                loadViewColumns()
                reloadData?.()
              })
          }
          view.value.show_system_fields = v
        }
        $e('a:fields:system-fields')
      },
    })

    const filteredFieldList = computed(() => {
      return (
        fields.value?.filter((field: Field) => {
          if (metaColumnById?.value?.[field.fk_column_id!]?.pv) return true

          // hide system columns if not enabled
          if (!showSystemFields.value && isSystemColumn(metaColumnById?.value?.[field.fk_column_id!])) {
            return false
          }

          if (filterQuery.value === '') {
            return true
          } else {
            return field.title.toLowerCase().includes(filterQuery.value.toLowerCase())
          }
        }) || []
      )
    })

    const sortedAndFilteredFields = computed<ColumnType[]>(() => {
      return (fields?.value
        ?.filter((field: Field) => {
          // hide system columns if not enabled
          if (
            !showSystemFields.value &&
            metaColumnById.value &&
            metaColumnById?.value?.[field.fk_column_id!] &&
            isSystemColumn(metaColumnById.value?.[field.fk_column_id!]) &&
            !metaColumnById.value?.[field.fk_column_id!]?.pv
          ) {
            return false
          }
          return field.show && metaColumnById?.value?.[field.fk_column_id!]
        })
        ?.sort((a: Field, b: Field) => a.order - b.order)
        ?.map((field: Field) => metaColumnById?.value?.[field.fk_column_id!]) || []) as ColumnType[]
    })

    const toggleFieldVisibility = (checked: boolean, field: any) => {
      const fieldIndex = fields.value?.findIndex((f) => f.fk_column_id === field.fk_column_id)
      if (!fieldIndex && fieldIndex !== 0) return
      addUndo({
        undo: {
          fn: (v: boolean) => {
            field.show = !v
            saveOrUpdate(field, fieldIndex)
          },
          args: [checked],
        },
        redo: {
          fn: (v: boolean) => {
            field.show = v
            saveOrUpdate(field, fieldIndex)
          },
          args: [checked],
        },
        scope: defineViewScope({ view: view.value }),
      })
      saveOrUpdate(field, fieldIndex)
    }

    // reload view columns when active view changes
    // or when columns count changes(delete/add)
    watch(
      [() => view?.value?.id, () => meta.value?.columns?.length],
      async ([newViewId]) => {
        // reload only if view belongs to current table
        if (newViewId && view.value?.fk_model_id === meta.value?.id) {
          isViewColumnsLoading.value = true
          try {
            await loadViewColumns()
          } catch (e) {
            console.error(e)
          }
          isViewColumnsLoading.value = false
        }
      },
      { immediate: true },
    )

    const resizingColOldWith = ref('200px')

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
        await loadViewColumns()
      }
    }

    return {
      fields,
      loadViewColumns,
      filteredFieldList,
      filterQuery,
      showAll,
      hideAll,
      saveOrUpdate,
      sortedAndFilteredFields,
      showSystemFields,
      metaColumnById,
      toggleFieldVisibility,
      isViewColumnsLoading,
      updateGridViewColumn,
      gridViewCols,
      resizingColOldWith,
    }
  },
  'useViewColumnsOrThrow',
)

export { useProvideViewColumns }

export function useViewColumnsOrThrow() {
  const viewColumns = useViewColumns()
  if (viewColumns == null) throw new Error('Please call `useProvideViewColumns` on the appropriate parent component')
  return viewColumns
}
