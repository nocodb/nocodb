import rfdc from 'rfdc'
import type { ColumnReqType, ColumnType, PluginType, TableType } from 'nocodb-sdk'
import { UITypes, isLinksOrLTAR } from 'nocodb-sdk'
import type { Ref } from 'vue'
import type { RuleObject } from 'ant-design-vue/es/form'
import { generateUniqueColumnName } from '~/helpers/parsers/parserHelpers'

const [useProvideAccountSetupStore, useAccountSetupStore] = createInjectionState(() => {
  const apps = ref<(PluginType & { parsedInput?: Record<string, any>; tags?: string[] })[]>([])

  const { $api, $e } = useNuxtApp()

  const emailApps = computed(() => apps.value.filter((app) => app.category === 'Email'))
  const storageApps = computed(() => apps.value.filter((app) => app.category === ('Storage')))

  const loadSetupApps = async () => {
    try {
      const plugins = (await $api.plugin.list()).list ?? []

      apps.value = plugins.map((p) => ({
        ...p,
        tags: p.tags ? p.tags.split(',') : [],
        parsedInput: p.input && JSON.parse(p.input as string),
      })) as any[]
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  return {
    apps,
    emailApps,
    storageApps,
    loadSetupApps,
  }
})

export { useProvideAccountSetupStore }

export function useAccountSetupStoreOrThrow() {
  const columnCreateStore = useAccountSetupStore()

  if (columnCreateStore == null) throw new Error('Please call `useProvideAccountSetupStore` on the appropriate parent component')

  return columnCreateStore
}
