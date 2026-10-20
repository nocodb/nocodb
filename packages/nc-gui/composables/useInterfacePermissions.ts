export const useInterfacePermissions = createSharedComposable(() => {
  const isInterfaceOnlyUser = computed(() => false)

  const maybeNavigateToInterfaceOnlyBase = async (_base: NcProject) => false

  const isInterfacesUiEnabled = computed(() => false)

  const baseHasRealRole = (_base?: NcProject | null) => false

  return {
    isInterfaceOnlyUser,
    maybeNavigateToInterfaceOnlyBase,
    isInterfacesUiEnabled,
    baseHasRealRole,
  }
})
