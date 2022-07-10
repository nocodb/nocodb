import type { FormType, GalleryType, GridType, TableType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { useNuxtApp } from '#app'

export default function (
  view: Ref<(GridType | FormType | GalleryType) & { id?: string }> | undefined,
  meta: Ref<TableType> | undefined,
  isPublic = false,
) {
  const fields = ref<
    {
      order?: number
      show?: number
      title: string
      fk_column_id?: string
    }[]
  >()

  const filterQuery = ref('')
  const filteredFieldList = computed(() => {
    return fields.value?.filter((field) => {
      return !filterQuery?.value || field.title.toLowerCase().includes(filterQuery.value)
    })
  })

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

  const showAll = () => {}
  const hideAll = () => {}

  const sync = async (field: any, index: number) => {
    if (field.id) {
      await $api.dbViewColumn.update(view?.value?.id as string, field.id, field)
    } else {
      if (fields.value) fields.value[index] = (await $api.dbViewColumn.create(view?.value?.id as string, field)) as any
    }
  }

  return { fields, loadViewColumns, filteredFieldList, filterQuery, showAll, hideAll, sync }
}
