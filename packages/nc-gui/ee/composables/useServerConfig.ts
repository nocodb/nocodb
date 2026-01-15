export const CONFIG_KEYS = {
  MAINTENANCE: 'maintenance',
  MAINTENANCE_STAGING: 'maintenance_staging',
}

const useServerConfig = createSharedComposable(() => {
  const config = new Map<string, unknown>()

  const { appInfo } = useGlobal()

  const runtimeConfig = useRuntimeConfig()

  const getConfig = async (key: string, force = false) => {
    if (!force && config.has(key)) {
      return config.get(key)
    }

    if (process.env.NODE_ENV !== 'production') return {}

    if (appInfo.value?.isOnPrem) return {}

    try {
      const response = await fetch(`${runtimeConfig.public.configServerUrl}/api/v1/config?get=${key}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.error('Failed to fetch config', response)
      }

      const res = await response.json()

      if (res?.value) {
        config.set(key, res.value)
        return res.value
      }
      return null
    } catch (e) {
      console.error(e)
    }
  }

  const checkMaintenance = async () => {
    let key = CONFIG_KEYS.MAINTENANCE_STAGING

    if (appInfo.value.ncSiteUrl === 'https://app.nocodb.com') {
      key = CONFIG_KEYS.MAINTENANCE
    }

    let maintenance = (await getConfig(key)) as {
      endDate: string
      startDate: string
      description: string
      title: string
      url?: string
    }

    if (typeof maintenance === 'string') {
      maintenance = JSON.parse(maintenance)
    }

    if (!maintenance) return

    const now = new Date()

    if (new Date(maintenance.endDate) > now) {
      const lastDismissedDate = localStorage.getItem('lastMaintenanceDismissed')
      const todayString = now.toISOString().split('T')[0]

      if (lastDismissedDate !== todayString) {
        return maintenance
      }
    }
  }

  const dismissMaintenance = () => {
    localStorage.setItem('lastMaintenanceDismissed', new Date().toISOString().split('T')[0])
  }

  return {
    getConfig,
    checkMaintenance,
    dismissMaintenance,
  }
})

export default useServerConfig
