import { isSystemColumn } from 'nocodb-sdk'
import type { ColumnType, FormType, GalleryType, GridType, TableType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { useNuxtApp } from '#app'

export default function (
  view: Ref<(GridType | FormType | GalleryType) & { id?: string }> | undefined,
  meta: Ref<TableType> | undefined,
  isPublic = false,
  reloadData?: () => void,
) {
  const fields = ref<
    {
      order: number
      show: number | boolean
      title: string
      fk_column_id?: string
    }[]
  >()

  const filterQuery = ref('')

  const { $api } = useNuxtApp()

  const loadViewColumns = async () => {
    if (!meta || !view) return

    let order = 1
    if (view?.value?.id) {
      const data = await $api.dbViewColumn.list(view?.value?.id as string)
      const fieldById: Record<string, any> = data.reduce((o: Record<string, any>, f: any) => {
        f.show = !!f.show
        return {
          ...o,
          [f.fk_column_id as string]: f,
        }
      }, {})
      fields.value = meta.value?.columns
        ?.map((c) => ({
          title: c.title,
          fk_column_id: c.id,
          ...(fieldById[c.id as string] ? fieldById[c.id as string] : {}),
          order: (fieldById[c.id as string] && fieldById[c.id as string].order) || order++,
        }))
        .sort((a, b) => a.order - b.order)
    } else if (isPublic) {
      fields.value = meta.value.columns as any
    }
  }

  const showAll = async () => {
    await $api.dbView.showAllColumn(view?.value?.id as string)
    await loadViewColumns()
    reloadData?.()
  }
  const hideAll = async () => {
    await $api.dbView.hideAllColumn(view?.value?.id as string)
    await loadViewColumns()
    reloadData?.()
  }

  const saveOrUpdate = async (field: any, index: number) => {
    if (field.id) {
      await $api.dbViewColumn.update(view?.value?.id as string, field.id, field)
    } else {
      if (fields.value) fields.value[index] = (await $api.dbViewColumn.create(view?.value?.id as string, field)) as any
    }
    reloadData?.()
  }

  const metaColumnById = computed(() => {
    return meta?.value?.columns?.reduce<Record<string, ColumnType>>((o: Record<string, any>, c: any) => {
      return {
        ...o,
        [c.id]: c,
      }
    }, {})
  })

  const showSystemFields = computed({
    get() {
      // todo: update swagger
      return (view?.value as any)?.show_system_fields || false
    },
    set(v) {
      if (view?.value) {
        $api.dbView.update(
          view?.value?.id as string,
          {
            // todo: update swagger
            show_system_fields: v,
          } as any,
        )
        ;(view.value as any).show_system_fields = v
      }
    },
  })

  const filteredFieldList = computed(() => {
    return fields.value?.filter((field) => {
      // hide system columns if not enabled
      if (!showSystemFields.value && isSystemColumn(metaColumnById?.value?.[field.fk_column_id as string])) {
        return false
      }

      return !filterQuery?.value || field.title.toLowerCase().includes(filterQuery.value)
    })
  })

  const sortedAndFilteredFields = computed<ColumnType[]>(() => {
    return (fields?.value
      ?.filter((c) => {
        // hide system columns if not enabled
        if (
          !showSystemFields.value &&
          metaColumnById.value &&
          metaColumnById?.value?.[c.fk_column_id as string] &&
          isSystemColumn(metaColumnById?.value?.[c.fk_column_id as string])
        ) {
          return false
        }
        return c.show
      })
      ?.sort((c1, c2) => c1.order - c2.order)
      ?.map((c) => metaColumnById?.value?.[c.fk_column_id as string]) || []) as ColumnType[]
  })
  const sortedFields = computed<ColumnType[]>(() => {
    return (fields?.value?.sort((c1, c2) => c1.order - c2.order)?.map((c) => metaColumnById?.value?.[c.fk_column_id as string]) ||
      []) as ColumnType[]
  })

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
    sortedFields,
  }
}
