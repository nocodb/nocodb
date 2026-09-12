export type ExpandedFormMode = 'panel' | 'modal'

// Mode is derived purely from the `expanded_record_panel` experimental feature
// flag — no in-product toggle. Users who want the old modal back can disable
// the flag from experimental features. Mobile and public views ignore the
// result and force the modal regardless.
export const useExpandedFormMode = createSharedComposable(() => {
  const { isFeatureEnabled } = useBetaFeatureToggle()

  const mode = computed<ExpandedFormMode>(() => (isFeatureEnabled(FEATURE_FLAG.EXPANDED_RECORD_PANEL) ? 'panel' : 'modal'))

  return { mode }
})
