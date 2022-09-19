import { isString } from '@vueuse/core'
import { computed, createSharedComposable, ref, useApi, useGlobal } from '#imports'
import type { ProjectRole, Role, Roles } from '~/lib'

export const useRoles = createSharedComposable(() => {
  const { user } = useGlobal()

  const { api } = useApi()

  const projectRoles = ref<Roles<ProjectRole>>({})

  const userRoles = computed<Roles<Role>>(() => {
    let roles = user.value?.roles ?? {}

    // if string populate key-value paired object
    if (isString(roles)) {
      roles = roles.split(',').reduce<Roles>((acc, role) => {
        acc[role] = true
        return acc
      }, {})
    }

    return roles
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
})
