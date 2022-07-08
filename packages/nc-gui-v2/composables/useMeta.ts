import { TableType } from 'nocodb-sdk'
import useMetas from '~/composables/useMetas'

export default function (metaIdOrTitle: string) {
  const { metas, getMeta } = useMetas()
  const meta = computed(() => {
    return metas.value?.[metaIdOrTitle]
  })

  const loadMeta = async () => {
    await getMeta(metaIdOrTitle)
  }

  return { meta, loadMeta }
}
