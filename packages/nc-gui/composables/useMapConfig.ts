import { MapProvider } from 'nocodb-sdk'

export function useMapConfig() {
  const { appInfo } = useGlobal()
  const { base } = storeToRefs(useBase())
  const { $api } = useNuxtApp()
  const meta = inject(MetaInj, ref())
  const { sharedView } = useSharedView()

  /**
   * Build tile URL based on configured map provider
   */
  const tileUrl = computed(() => {
    const mapProvider = appInfo.value.mapProvider || MapProvider.OPENSTREETMAP

    console.log('mapProvider', mapProvider)
    // Providers that require API key and backend proxy
    if (mapProvider === MapProvider.STADIAMAP_APIKEY) {
      const apiBaseUrl = $api.instance.defaults.baseURL

      // Shared view: use public shared view endpoint
      if (sharedView.value?.uuid) {
        return `${apiBaseUrl}/api/v1/db/public/shared-view/${sharedView.value.uuid}/maptile?x={x}&y={y}&z={z}`
      }

      // Regular view: use workspace/base endpoint
      const workspaceId = base.value?.fk_workspace_id
      const baseId = base.value?.id
      const tableId = meta.value?.id

      return workspaceId && baseId
        ? `${apiBaseUrl}/api/v1/bases/${baseId}/maptile?x={x}&y={y}&z={z}${tableId ? `&tableId=${tableId}` : ''}`
        : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' // Fallback
    }

    // Direct tile URLs (no proxy needed)
    if (mapProvider === MapProvider.STADIAMAP) {
      return 'https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}.png' // Free tier
    }

    // Default: OpenStreetMap
    return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
  })

  /**
   * Attribution text based on map provider
   */
  const attribution = computed(() => {
    const mapProvider = appInfo.value.mapProvider || MapProvider.OPENSTREETMAP

    if (mapProvider === MapProvider.STADIAMAP || mapProvider === MapProvider.STADIAMAP_APIKEY) {
      return '&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
    }

    // Default: OpenStreetMap
    return '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  })

  return {
    tileUrl,
    attribution,
  }
}
