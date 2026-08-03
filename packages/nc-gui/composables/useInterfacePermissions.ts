export const useInterfacePermissions = createSharedComposable(() => {
  const isInterfaceOnlyUser = computed(() => false)

  const maybeNavigateToInterfaceOnlyBase = (_base: NcProject) => false

  const navigateToBaseInterface = (_base: NcProject) => {}

  const isInterfacesUiEnabled = computed(() => false)

  const baseOpensInterfaceByDefault = (_base?: NcProject | null) => false

  const baseHasRealRole = (_base?: NcProject | null) => false

  return {
    isInterfaceOnlyUser,
    maybeNavigateToInterfaceOnlyBase,
    navigateToBaseInterface,
    isInterfacesUiEnabled,
    baseOpensInterfaceByDefault,
    baseHasRealRole,
  }
})
