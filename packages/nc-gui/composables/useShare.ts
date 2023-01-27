const [setup, use] = useInjectionState(() => {
  const visibility = ref<'public' | 'private'>('private')

  return {
    visibility,
  }
}, 'useShare')

export const provideShare = setup

export function useShare() {
  const state = use()

  if (!state) {
    return setup()
  }

  return state
}
