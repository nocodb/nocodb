import { useNuxtApp } from '#app'

export default function (viewId: string) {
  const columns = ref<any[]>()
  const { metas, getMeta } = useMetas()
  const { $api } = useNuxtApp()

  const loadColumns = async () => {
    const data = await $api.dbViewColumn.list(viewId)
    const fieldById = data.reduce(
      (o, f) => ({
        ...o,
        [f.fk_column_id]: f,
      }),
      {},
    )
    // const
    // fields = this.meta.columns
    //   .map((c) => ({
    //     title: c.title,
    //     fk_column_id: c.id,
    //     ...(fieldById[c.id] ? fieldById[c.id] : {}),
    //     order: (fieldById[c.id] && fieldById[c.id].order) || order++,
    //     icon: getUIDTIcon(c.uidt)
    //   }))
    //   .sort((a, b) => a.order - b.order);
  }

  return {}
}
