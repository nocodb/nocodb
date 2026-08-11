import type { FocusPresenceParams, GridRemoteFocusMap } from '~/lib/types'

export function useGridFocusPresence(_params: FocusPresenceParams): {
  remoteFocuses: Ref<GridRemoteFocusMap>
} {
  return { remoteFocuses: ref<GridRemoteFocusMap>(new Map()) }
}
