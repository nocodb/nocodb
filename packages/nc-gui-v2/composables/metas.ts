import type { Api, TableType } from 'nocodb-sdk'
import { useNuxtApp, useState } from '#app'
import { useUser } from '~/composables/user'
import { useProject } from '~/composables/project'

export const useMetas = () => {
  const { $api } = useNuxtApp()
  const { user } = useUser()
  const { tables } = useProject()

  const metas = useState<{ [idOrTitle: string]: TableType | any }>('metas', () => ({}))

  const getMeta = async (tableIdOrTitle: string, force = false) => {
    if (!force && metas[tableIdOrTitle])
      return metas[tableIdOrTitle]

    const modelId = (tables.value.find(t => t.title === tableIdOrTitle || t.id === tableIdOrTitle) || {}).id
    if (!modelId) {
      console.warn(`Table '${tableIdOrTitle}' is not found in the table list`)
      return
    }

    const model = await $api.dbTable.read(modelId, {
      headers: {
        'xc-auth': user.token,
      },
    })

    metas.value = {
      ...metas.value,
      [model.id]: model,
      [model.title]: model,
    }

    return model
  }

  return { getMeta, metas }
}
