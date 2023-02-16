import type { MaybeRef } from '@vueuse/core'
import { computed, unref, useRouter } from '#imports'

export interface CellUrlOptions {
  behavior?: string
  overlay?: string
}

type ParsedRules = [RegExp, CellUrlOptions]

const parseUrlRules = (serialized?: string): ParsedRules[] | undefined => {
  if (!serialized) return undefined

  try {
    return Object.entries(JSON.parse(serialized)).map(([key, value]) => [new RegExp(key), value] as ParsedRules)
  } catch (err) {
    console.error(err)

    return undefined
  }
}

export function useCellUrlConfig(url?: MaybeRef<string>) {
  const router = useRouter()

  const route = $(router.currentRoute)

  const config = $computed(() => ({
    behavior: route.query.url_behavior as string | undefined,
    overlay: route.query.url_overlay as string | undefined,
    rules: parseUrlRules(route.query.url_rules as string),
  }))

  const options = computed(() => {
    const options = { behavior: config.behavior, overlay: config.overlay }

    if (config.rules && (!config.behavior || !config.overlay)) {
      for (const [regex, value] of config.rules) {
        if (unref(url)?.match(regex)) return Object.assign(options, value)
      }
    }

    return options
  })

  return {
    cellUrlConfig: config,
    cellUrlOptions: options,
  }
}
