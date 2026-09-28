import type {
  FocusPresenceParams,
  GridFollowedFocus,
  GridRemoteFieldMap,
  GridRemoteFocusMap,
  GridRemoteRecordMap,
} from '~/lib/types'

/** CE stub — focus presence is EE-only. Empty maps render nothing. */
export function useGridFocusPresence(_params: FocusPresenceParams): {
  remoteFocuses: Ref<GridRemoteFocusMap>
  remoteRecords: Ref<GridRemoteRecordMap>
  remoteFields: Ref<GridRemoteFieldMap>
  followedFocus: ComputedRef<GridFollowedFocus | null>
} {
  return {
    remoteFocuses: ref<GridRemoteFocusMap>(new Map()),
    remoteRecords: ref<GridRemoteRecordMap>(new Map()),
    remoteFields: ref<GridRemoteFieldMap>(new Map()),
    followedFocus: computed(() => null),
  }
}
