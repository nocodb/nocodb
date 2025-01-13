import {
  type ColumnType,
  CommonAggregations,
  type GridColumnReqType,
  type GridColumnType,
  type MapType,
  type TableType,
  type ViewType,
} from 'nocodb-sdk'
import { ViewTypes, isHiddenCol, isSystemColumn } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'

const [useProvideViewColumns, useViewColumns] = useInjectionState(
  (
    view: Ref<ViewType | undefined>,
    meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>,
    reloadData?: (params?: { shouldShowLoading?: boolean }) => void,
    isPublic = false,
  ) => {
    const rootFields = ref<ColumnType[]>([])

    const fields = ref<Field[]>()

    const fieldsMap = computed(() =>
      (fields.value || []).reduce<Record<string, any>>((acc, curr) => {
        if (curr.fk_column_id) {
          acc[curr.fk_column_id] = curr
        }
        return acc
      }, {}),
    )

    const filterQuery = ref('')

    const { $api, $e } = useNuxtApp()

    const { isUIAllowed } = useRoles()

    const { isSharedBase } = storeToRefs(useBase())

    const isViewColumnsLoading = ref(false)

    const { addUndo, defineViewScope } = useUndoRedo()

    const isLocalMode = computed(() => isPublic || !isUIAllowed('viewFieldEdit') || isSharedBase.value)

    const localChanges = ref<Record<string, Field>>({})

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
          ?.filter((column: ColumnType) => {
            // filter created by and last modified by system columns
            if (isHiddenCol(column, meta.value)) return false
            return true
          })
          .map((column: ColumnType) => {
            const currentColumnField = fieldById[column.id!] || {}

            return {
              title: column.title,
              fk_column_id: column.id,
              ...currentColumnField,
              show: currentColumnField.show || isColumnViewEssential(currentColumnField),
              order: currentColumnField.order || order++,
              aggregation: currentColumnField?.aggregation ?? CommonAggregations.None,
              system: isSystemColumn(metaColumnById?.value?.[currentColumnField.fk_column_id!]),
              isViewEssentialField: isColumnViewEssential(column),
              initialShow:
                currentColumnField.show ||
                isColumnViewEssential(currentColumnField) ||
                (currentColumnField as GridColumnType)?.group_by,
            }
          })
          .sort((a: Field, b: Field) => a.order - b.order)

        if (isLocalMode.value && fields.value) {
          for (const key in localChanges.value) {
            const fieldIndex = fields.value.findIndex((f) => f.fk_column_id === key)
            if (fieldIndex !== undefined && fieldIndex > -1) {
              fields.value[fieldIndex] = localChanges.value[key]
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

    const updateDefaultViewColumnMeta = async (
      columnId?: string,
      colMeta: { defaultViewColOrder?: number; defaultViewColVisibility?: boolean } = {},
      allFields = false,
    ) => {
      if (!meta.value?.columns) return

      meta.value.columns = (meta.value.columns || []).map((c: ColumnType) => {
        if (!allFields && c.id !== columnId) return c

        if (allFields && c.pv) return c

        c.meta = { ...parseProp(c.meta || {}), ...colMeta }
        return c
      })

      if (!allFields && columnId && meta.value?.columnsById?.[columnId]) {
        meta.value.columnsById[columnId].meta = {
          ...parseProp(meta.value.columnsById[columnId].meta),
          ...colMeta,
        }
      }

      if (allFields) {
        meta.value.columnsById = meta.value.columns.reduce((acc, c) => {
          acc[c.id!] = c

          return acc
        }, {} as Record<string, ColumnType>)
      }
    }

    const showAll = async (ignoreIds?: any) => {
      if (isLocalMode.value) {
        const fieldById = (fields.value || []).reduce<Record<string, any>>((acc, curr) => {
          if (curr.fk_column_id) {
            curr.show = !!curr.initialShow
            acc[curr.fk_column_id] = curr
          }
          return acc
        }, {})

        fields.value = (fields.value || [])?.map((field: Field) => {
          const updateField = {
            ...field,
            show: fieldById[field.fk_column_id!]?.show,
          }
          localChanges.value[field.fk_column_id!] = field
          return updateField
        })

        meta.value!.columns = meta.value!.columns?.map((column: ColumnType) => {
          if (fieldById[column.id!]) {
            return {
              ...column,
              ...fieldById[column.id!],
              id: fieldById[column.id!].fk_column_id,
            }
          }
          return column
        })

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

        if (view.value?.is_default) {
          updateDefaultViewColumnMeta(undefined, { defaultViewColVisibility: true }, true)
        }
      }

      await loadViewColumns()
      reloadData?.()
      $e('a:fields:show-all')
    }

    const hideAll = async (ignoreIds?: any) => {
      if (isLocalMode.value) {
        const fieldById = (fields.value || []).reduce<Record<string, any>>((acc, curr) => {
          if (curr.fk_column_id) {
            curr.show = !!metaColumnById?.value?.[curr.fk_column_id!]?.pv || !!curr.isViewEssentialField
            acc[curr.fk_column_id] = curr
          }
          return acc
        }, {})

        fields.value = (fields.value || [])?.map((field: Field) => {
          const updateField = {
            ...field,
            show: fieldById[field.fk_column_id!]?.show,
          }
          localChanges.value[field.fk_column_id!] = field
          return updateField
        })

        meta.value!.columns = meta.value!.columns?.map((column: ColumnType) => {
          if (fieldById[column.id!]) {
            return {
              ...column,
              ...fieldById[column.id!],
              id: fieldById[column.id!].fk_column_id,
            }
          }
          return column
        })

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

        if (view.value?.is_default) {
          updateDefaultViewColumnMeta(undefined, { defaultViewColVisibility: false }, true)
        }
      }

      await loadViewColumns()
      reloadData?.()
      $e('a:fields:show-all')
    }

    const saveOrUpdate = async (field: any, index: number, disableDataReload = false, updateDefaultViewColMeta = false) => {
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

        localChanges.value[field.fk_column_id] = field
      }

      if (isUIAllowed('viewFieldEdit')) {
        if (field.id && view?.value?.id) {
          await $api.dbViewColumn.update(view.value.id, field.id, field)

          if (updateDefaultViewColMeta) {
            updateDefaultViewColumnMeta(field.fk_column_id, {
              defaultViewColOrder: field.order,
              defaultViewColVisibility: field.show,
            })
          }
        } else if (view.value?.id) {
          const insertedField = (await $api.dbViewColumn.create(view.value.id, field)) as any

          /** update the field in fields if defined */
          if (fields.value) fields.value[index] = insertedField

          return insertedField
        }
      }

      if (!disableDataReload) {
        await loadViewColumns()
        reloadData?.({ shouldShowLoading: false })
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
          if (!field.initialShow && isLocalMode.value) {
            return false
          }

          if (
            metaColumnById?.value?.[field.fk_column_id!]?.pv &&
            (!filterQuery.value || field.title.toLowerCase().includes(filterQuery.value.toLowerCase()))
          ) {
            return true
          }

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

    const numberOfHiddenFields = computed(() => {
      return (fields.value || [])
        ?.filter((field: Field) => {
          if (!field.initialShow && isLocalMode.value) {
            return false
          }

          if (metaColumnById?.value?.[field.fk_column_id!]?.pv) {
            return true
          }

          // hide system columns if not enabled
          if (!showSystemFields.value && isSystemColumn(metaColumnById?.value?.[field.fk_column_id!])) {
            return false
          }

          return true
        })
        .filter((field) => !field.show)?.length
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
            saveOrUpdate(field, fieldIndex, false, !!view.value?.is_default)
          },
          args: [checked],
        },
        redo: {
          fn: (v: boolean) => {
            field.show = v
            saveOrUpdate(field, fieldIndex, false, !!view.value?.is_default)
          },
          args: [checked],
        },
        scope: defineViewScope({ view: view.value }),
      })
      saveOrUpdate(field, fieldIndex, !checked, !!view.value?.is_default)
    }

    const toggleFieldStyles = (field: any, style: 'underline' | 'bold' | 'italic', status: boolean) => {
      const fieldIndex = fields.value?.findIndex((f) => f.fk_column_id === field.fk_column_id)
      if (!fieldIndex && fieldIndex !== 0) return
      field[style] = status
      $e('a:fields:style', { style, status })
      saveOrUpdate(field, fieldIndex, true)
    }

    // reload view columns when active view changes
    // or when columns changes(delete/add)
    watch(
      [() => view?.value?.id, () => meta.value?.columns],
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

    const resizingColOldWith = ref('180px')

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
      try {
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
      } catch (e) {
        // this could happen if user doesn't have permission to update view columns
        // todo: find out root cause and handle with isUIAllowed
        console.error(e)
      }
    }

    watch(
      sortedAndFilteredFields,
      (v) => {
        if (rootFields) rootFields.value = v || []
      },
      { immediate: true },
    )

    provide(FieldsInj, rootFields)

    return {
      fields,
      fieldsMap,
      loadViewColumns,
      filteredFieldList,
      numberOfHiddenFields,
      filterQuery,
      showAll,
      hideAll,
      saveOrUpdate,
      sortedAndFilteredFields,
      showSystemFields,
      metaColumnById,
      toggleFieldVisibility,
      toggleFieldStyles,
      isViewColumnsLoading,
      updateGridViewColumn,
      gridViewCols,
      resizingColOldWith,
      isLocalMode,
      updateDefaultViewColumnMeta,
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
