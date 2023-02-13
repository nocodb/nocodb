import { isSystemColumn, MapType, ViewTypes } from 'nocodb-sdk'
import type { ColumnType, TableType, ViewType } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import { IsPublicInj, computed, inject, ref, useNuxtApp, useProject, useUIPermission, watch } from '#imports'
import type { Field } from '~/lib'

export function useViewColumns(
  view: Ref<ViewType | undefined>,
  meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>,
  reloadData?: () => void,
) {
  const isPublic = inject(IsPublicInj, ref(false))

  const fields = ref<Field[]>()

  const filterQuery = ref('')

  const { $api, $e } = useNuxtApp()

  const { isUIAllowed } = useUIPermission()

  const { isSharedBase } = useProject()

  const isLocalMode = computed(
    () => isPublic.value || !isUIAllowed('hideAllColumns') || !isUIAllowed('showAllColumns') || isSharedBase.value,
  )

  const isColumnViewEssential = (column: ColumnType) => {
    // TODO: consider at some point ti delegate this via a cleaner design pattern to view specific check logic
    // which could be inside of a view specific helper class (and generalized via an interface)
    // (on the other hand, the logic complexity is still very low atm - might be overkill)
    return view.value?.type === ViewTypes.MAP && (view.value?.view as MapType)?.fk_geo_data_col_id === column.id
  }

  const metaColumnById = computed<Record<string, ColumnType>>(() => {
    if (!meta.value?.columns) return {}

    return meta.value.columns.reduce(
      (acc, curr) => ({
        ...acc,
        [curr.id!]: curr,
      }),
      {},
    )
  })

  const loadViewColumns = async () => {

    if (!meta || !view) return

    let order = 1

    if (view.value?.id) {
      const data = (isPublic.value ? meta.value?.columns : await $api.dbViewColumn.list(view.value.id)) as any[]

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

  const saveOrUpdate = async (field: any, index: number) => {
    if (isPublic.value && fields.value) {
      fields.value[index] = field
      meta.value!.columns = meta.value!.columns?.map((column: ColumnType) => {
        if (column.id === field.fk_column_id) {
          return {
            ...column,
            ...field,
          }
        }
        return column
      })

      await loadViewColumns()
      reloadData?.()
    }

    if (isUIAllowed('fieldsSync')) {
      if (field.id && view?.value?.id) {
        await $api.dbViewColumn.update(view.value.id, field.id, field)
      } else if (view.value?.id) {
        const insertedField = (await $api.dbViewColumn.create(view.value.id, field)) as any

        /** update the field in fields if defined */
        if (fields.value) fields.value[index] = insertedField

        return insertedField
      }
    }
    await loadViewColumns()
    reloadData?.()
  }

  const showSystemFields = computed({
    get() {
      return view.value?.show_system_fields || false
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

  // reload view columns when active view changes
  // or when columns count changes(delete/add)
  watch(
    [() => view?.value?.id, () => meta.value?.columns?.length],
    async ([newViewId]) => {
      // reload only if view belongs to current table
      if (newViewId && view.value?.fk_model_id === meta.value?.id) {
        await loadViewColumns()
      }
    },
    { immediate: true },
  )

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
  }
}
