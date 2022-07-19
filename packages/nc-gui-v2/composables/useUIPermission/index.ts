import rolePermissions from './rolePermissions'

export default () => {
  const { $state } = useNuxtApp()

  const isUIAllowed = (permission: keyof typeof rolePermissions[keyof typeof rolePermissions], _skipPreviewAs = false) => {
    const user = $state.user
    const roles = {
      ...(user?.value?.roles || {}),
      // todo: load project specific roles
      // ...(state.projectRole || {}),
    }

    // todo: handle preview as
    // if (state.previewAs && !skipPreviewAs) {
    //   roles = {
    //     [state.previewAs]: true
    //   };
    // }
    return Object.entries(roles).some(([role, hasRole]) => {
      return (
        hasRole &&
        (rolePermissions[role as keyof typeof rolePermissions] === '*' ||
          rolePermissions[role as keyof typeof rolePermissions]?.[permission])
      )
    })
  }

  return { isUIAllowed }
}
