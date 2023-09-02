import { isString } from '@vue/shared'
import { extractRolesObj } from 'nocodb-sdk'
import { computed, createSharedComposable, useApi, useGlobal } from '#imports'
import type { ProjectRole, Role, Roles } from '#imports'

/**
 * Provides the roles a user currently has
 *
 * * `userRoles` - the roles a user has outside of projects
 * * `projectRoles` - the roles a user has in the current project (if one was loaded)
 * * `allRoles` - all roles a user has (userRoles + projectRoles)
 * * `hasRole` - a function to check if a user has a specific role
 * * `loadRoles` - a function to load reload user roles for scope
 */
export const useRoles = createSharedComposable(() => {
  const { user, previewAs } = useGlobal()

  const { api } = useApi()

  const router = useRouter()

  const route = router.currentRoute

  const allRoles = computed<Roles>(() => {
    let orgRoles = user.value?.roles ?? {}

    // if string populate key-value paired object
    if (isString(orgRoles)) {
      orgRoles = extractRolesObj(orgRoles)
    }

    let projectRoles = user.value?.project_roles ?? user.value?.workspace_roles ?? {}

    // if string populate key-value paired object
    if (isString(projectRoles)) {
      projectRoles = extractRolesObj(projectRoles)
    }

    return {
      ...orgRoles,
      ...projectRoles,
    }
  })

  const orgRoles = computed<Roles>(() => {
    let orgRoles = user.value?.roles ?? {}

    // if string populate key-value paired object
    if (isString(orgRoles)) {
      orgRoles = extractRolesObj(orgRoles)
    }

    return orgRoles
  })

  const projectRoles = computed<Roles>(() => {
    let projectRoles = user.value?.project_roles ?? user.value?.workspace_roles ?? {}

    // if string populate key-value paired object
    if (isString(projectRoles)) {
      projectRoles = extractRolesObj(projectRoles)
    }

    return projectRoles
  })

  const workspaceRoles = computed<Roles>(() => {
    let workspaceRoles = user.value?.workspace_roles ?? {}

    // if string populate key-value paired object
    if (isString(workspaceRoles)) {
      workspaceRoles = extractRolesObj(workspaceRoles)
    }

    return workspaceRoles
  })

  async function loadRoles(
    projectId?: string,
    options: { isSharedBase?: boolean; sharedBaseId?: string; isSharedErd?: boolean; sharedErdId?: string } = {},
  ) {
    const wsId = {
      fk_workspace_id: route.value.params.typeOrId,
    }

    if (options?.isSharedBase) {
      const res = await api.auth.me(
        {
          project_id: projectId,
        },
        {
          headers: {
            'xc-shared-base-id': options?.sharedBaseId,
          },
        },
      )

      user.value = {
        ...user.value,
        roles: res.roles,
        project_roles: res.project_roles,
        workspace_roles: res.workspace_roles,
      }
    } else if (options?.isSharedErd) {
      const res = await api.auth.me(
        {
          project_id: projectId,
        },
        {
          headers: {
            'xc-shared-erd-id': options?.sharedErdId,
          },
        },
      )

      user.value = {
        ...user.value,
        roles: res.roles,
        project_roles: res.project_roles,
        workspace_roles: res.workspace_roles,
      }
    } else if (projectId) {
      const res = await api.auth.me({ project_id: projectId, ...wsId })

      user.value = {
        ...user.value,
        roles: res.roles,
        project_roles: res.project_roles,
        workspace_roles: res.workspace_roles,
      }
    }
  }

  function hasRole(role: Role | ProjectRole | string, includePreviewRoles = false) {
    if (previewAs.value && includePreviewRoles) {
      return previewAs.value === role
    }

    return allRoles.value[role]
  }

  return { allRoles, orgRoles, workspaceRoles, projectRoles, loadRoles, hasRole }
})
