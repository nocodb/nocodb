import type { TableInfoType, TableType } from 'nocodb-sdk'
import { useProject } from './useProject'
import { useNuxtApp, useState } from '#app'

export function useMetas() {
  const { $api } = useNuxtApp()
  const { tables } = useProject()

  const metas = useState<{ [idOrTitle: string]: TableType | any }>('metas', () => ({}))

  const getMeta = async (tableIdOrTitle: string, force = false): Promise<TableType | TableInfoType | null> => {
    if (!force && metas.value[tableIdOrTitle as string]) return metas.value[tableIdOrTitle as string]

    const modelId = (tables.value.find((t) => t.title === tableIdOrTitle || t.id === tableIdOrTitle) || {}).id
    if (!modelId) {
      console.warn(`Table '${tableIdOrTitle}' is not found in the table list`)
      return null
    }

    const model = await $api.dbTable.read(modelId)

    metas.value = {
      ...metas.value,
      [model.id!]: model,
      [model.title]: model,
    }

    return model
  }

  const clearAllMeta = () => {
    metas.value = {}
  }
  const removeMeta = (idOrTitle: string) => {
    const meta = metas.value[idOrTitle]
    if (meta) {
      delete metas.value[meta.id]
      delete metas.value[meta.title]
    }
  }

  return { getMeta, clearAllMeta, metas, removeMeta }
}
