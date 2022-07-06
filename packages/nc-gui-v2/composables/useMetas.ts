import type { TableType } from 'nocodb-sdk'
import { useNuxtApp, useState } from '#app'
import useProject from "~/composables/useProject";

export default () => {
  const { $api } = useNuxtApp()
  const { tables } = useProject()

  const metas = useState<{ [idOrTitle: string]: TableType | any }>('metas', () => ({}))

  const getMeta = async (tableIdOrTitle: string, force = false) => {
    if (!force && metas[tableIdOrTitle as keyof typeof metas]) return metas[tableIdOrTitle as keyof typeof metas]

    const modelId = (tables.value.find((t) => t.title === tableIdOrTitle || t.id === tableIdOrTitle) || {}).id
    if (!modelId) {
      console.warn(`Table '${tableIdOrTitle}' is not found in the table list`)
      return
    }

    const model = await $api.dbTable.read(modelId)

    metas.value = {
      ...metas.value,
      [model.id!]: model,
      [model.title]: model,
    }

    return model
  }

  return { getMeta, metas }
}
