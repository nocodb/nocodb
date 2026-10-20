export interface BaseSettingsClassicApp {
  id: string
  title: string
  isLive: boolean
}

/** Classic apps are interfaces, which CE does not have. */
export function useBaseSettingsClassicApps() {
  return { classicApps: computed<BaseSettingsClassicApp[]>(() => []), isLoaded: computed(() => true) }
}
