import type { ComputedRef } from 'vue'
import { useRoute } from '#imports'

export interface CellUrlOptions {
  behavior?: string
  overlay?: string
}

const parseUrlRules = (serialized: string | undefined): Array<[RegExp, CellUrlOptions]> | undefined => {
  if (!serialized) return undefined
  try {
    const rules: Array<[RegExp, {}]> = Object.entries(JSON.parse(serialized)).map(([key, value]) => [
      new RegExp(key),
      value as {},
    ])
    return rules
  } catch (err) {
    console.error(err)
    return undefined
  }
}

const [useProvideCellUrlConfig, useCellUrlGeneralConfig] = useInjectionState(() => {
  const route = useRoute()

  return {
    behavior: route.query.url_behavior as string | undefined,
    overlay: route.query.url_overlay as string | undefined,
    rules: parseUrlRules(route.query.url_rules as string),
  }
}, 'cell-url-config')

export { useProvideCellUrlConfig }

export function useCellUrlConfig(url: ComputedRef<string>) {
  const config = useCellUrlGeneralConfig()
  if (!config) return undefined
  return computed(() => {
    const { behavior, overlay, rules } = config
    const options = { behavior, overlay }
    if (rules && (!behavior || !overlay)) {
      for (const [regex, value] of rules) {
        if (url.value.match(regex)) return Object.assign(options, value)
      }
    }
    return options
  })
}
