import { isString } from '@vueuse/core'
import { computed, ref, useApi, useGlobal, useInjectionState } from '#imports'
import type { ProjectRole, Role, Roles } from '~/lib'

const [setup, use] = useInjectionState(() => {
  const { user } = useGlobal()

  const { api } = useApi()

  const projectRoles = ref<Roles<ProjectRole>>({})

  const userRoles = computed<Roles<Role>>(() => {
    let userRoles = user.value?.roles ?? {}

    // if string populate key-value paired object
    if (isString(userRoles)) {
      userRoles = userRoles.split(',').reduce<Roles>((acc, role) => {
        acc[role] = true
        return acc
      }, {})
    }

    return userRoles
  })

  async function loadProjectRoles(projectId: string, isSharedBase: boolean) {
    projectRoles.value = {}

    if (isSharedBase) {
      const user = await api.auth.me(
        {},
        {
          headers: {
            'xc-shared-base-id': projectId,
          },
        },
      )

      projectRoles.value = user.roles
    } else if (projectId) {
      const user = await api.auth.me({ project_id: projectId })
      projectRoles.value = user.roles
    }
  }

  const allRoles = computed<Roles>(() => ({
    ...userRoles.value,
    ...projectRoles.value,
  }))

  return { allRoles, userRoles, projectRoles, loadProjectRoles }
}, 'useRoles')

export function useRoles() {
  const roles = use()

  if (!roles) {
    return setup()
  }

  return roles
}
