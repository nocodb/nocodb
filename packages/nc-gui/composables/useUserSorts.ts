import rfdc from 'rfdc'
import { OrderedOrgRoles, OrderedProjectRoles, OrderedWorkspaceRoles } from 'nocodb-sdk'
import dayjs from 'dayjs'
import type { UsersSortType } from '~/lib/types'

/**
 * Hook for managing user sorts and sort configurations.
 *
 * @param {string} roleType - The type of role for which user sorts are managed ('Workspace', 'Org', or 'Project').
 * @returns {object} An object containing reactive values and functions related to user sorts.
 */
export function useUserSorts(roleType: 'Workspace' | 'Org' | 'Project' | 'Organization' | 'Webhook') {
  const clone = rfdc()

  const { user } = useGlobal()

  const sorts = ref<UsersSortType>({})

  // Key for storing user sort configurations in local storage
  const userSortConfigKey = 'userSortConfig'

  // Default user ID if no user found (fallback)
  const defaultUserId = 'default'

  /**
   * Computed property that returns a record of sort directions based on the current sort configurations.
   * @type {ComputedRef<Record<string, UsersSortType['direction']>>}
   */
  const sortDirection: ComputedRef<Record<string, UsersSortType['direction']>> = computed(() => {
    if (sorts.value.field) {
      return { [sorts.value.field]: sorts.value.direction } as Record<string, UsersSortType['direction']>
    }
    return {} as Record<string, UsersSortType['direction']>
  })

  /**
   * Loads user sort configurations from local storage based on the current user ID.
   */
  function loadSorts(): void {
    try {
      // Retrieve sort configuration from local storage
      const storedConfig = localStorage.getItem(userSortConfigKey)

      const sortConfig = storedConfig ? JSON.parse(storedConfig) : ({} as Record<string, UsersSortType>)

      if (sortConfig && isValidSortConfig(sortConfig)) {
        // Load user-specific sort configurations or default configurations
        sorts.value = user.value?.id ? sortConfig[user.value.id] || {} : sortConfig[defaultUserId] || {}
      } else {
        throw new Error('Invalid sort config stored in local storage')
      }
    } catch (error) {
      console.error(error)

      // remove sortConfig from localStorage in case of error
      localStorage.removeItem(userSortConfigKey)

      // Set sorts to an empty obj in case of an error
      sorts.value = {}
    }
  }

  /**
   * Saves or updates a user sort configuration and updates local storage.
   * @param {UsersSortType} newSortConfig - The new sort configuration to save or update.
   */
  function saveOrUpdate(newSortConfig: UsersSortType): void {
    try {
      if (newSortConfig.field && newSortConfig.direction) {
        sorts.value = { ...newSortConfig }
      } else {
        sorts.value = {}
      }

      // Update local storage with the new sort configurations
      const storedConfig = localStorage.getItem(userSortConfigKey)
      const sortConfig = storedConfig ? JSON.parse(storedConfig) : {}

      if (user.value?.id) {
        // Save or delete user-specific sort configurations
        if (sorts.value.field) {
          sortConfig[user.value.id] = sorts.value
        } else {
          delete sortConfig[user.value.id]
        }
      } else {
        // Save or delete default user sort configurations
        sortConfig[defaultUserId] = sorts.value
      }

      localStorage.setItem(userSortConfigKey, JSON.stringify(sortConfig))
    } catch (error) {
      console.error('Error while saving sort configuration into local storage:', error)
    }
  }

  /**
   * Sorts and returns a deep copy of an array of objects based on the provided sort configurations.
   *
   * @param data - The array of objects to be sorted.
   * @param sortsConfig - The object of sort configurations.
   * @returns A new array containing sorted objects.
   * @template T - The type of objects in the input array.
   */
  function handleGetSortedData<T extends Record<string, any>>(data: T[], sortsConfig: UsersSortType = sorts.value): T[] {
    let userRoleOrder: string[] = []
    if (roleType === 'Workspace') {
      userRoleOrder = Object.values(OrderedWorkspaceRoles)
    } else if (roleType === 'Org') {
      userRoleOrder = Object.values(OrderedOrgRoles)
    } else if (roleType === 'Project') {
      userRoleOrder = Object.values(OrderedProjectRoles)
    } else if (roleType === 'Organization') {
      userRoleOrder = Object.values(OrderedOrgRoles)
    }

    data = clone(data)

    const superUserIndex = data.findIndex((user) => user?.roles?.includes('super'))
    const superUser = sortsConfig.field === 'roles' && superUserIndex !== -1 ? data.splice(superUserIndex, 1) : null

    let sortedData = data.sort((a, b) => {
      switch (sortsConfig.field) {
        case 'roles': {
          const roleA = a?.roles?.split(',')[0]
          const roleB = b?.roles?.split(',')[0]

          if (sortsConfig.direction === 'asc') {
            return userRoleOrder.indexOf(roleA) - userRoleOrder.indexOf(roleB)
          } else {
            return userRoleOrder.indexOf(roleB) - userRoleOrder.indexOf(roleA)
          }
        }
        case 'email':
        case 'title': {
          if (sortsConfig.direction === 'asc') {
            return a[sortsConfig.field]?.localeCompare(b[sortsConfig.field])
          } else {
            return b[sortsConfig.field]?.localeCompare(a[sortsConfig.field])
          }
        }
        case 'baseCount':
        case 'workspaceCount':
        case 'memberCount': {
          if (sortsConfig.direction === 'asc') {
            return a[sortsConfig.field] - b[sortsConfig.field]
          } else {
            return b[sortsConfig.field] - a[sortsConfig.field]
          }
        }
        case 'webhook-operation-type': {
          if (sortsConfig.direction === 'asc') {
            return `${a?.event} ${a?.operation}`?.localeCompare(`${b?.event} ${b?.operation}`)
          } else {
            return `${b?.event} ${b?.operation}`?.localeCompare(`${a?.event} ${a?.operation}`)
          }
        }
        case 'created_at':
        case 'updated_at': {
          if (sortsConfig.direction === 'asc') {
            return dayjs(a[sortsConfig.field]).isAfter(dayjs(b[sortsConfig.field])) ? 1 : -1
          } else {
            return dayjs(a[sortsConfig.field]).isBefore(dayjs(b[sortsConfig.field])) ? 1 : -1
          }
        }
      }

      return 0
    })

    if (superUser && superUser.length) {
      if (sortsConfig.direction === 'desc') {
        sortedData = [...sortedData, superUser[0]]
      } else {
        sortedData = [superUser[0], ...sortedData]
      }
    }

    return sortedData
  }

  /**
   * Checks if the provided sort configuration has the expected structure.
   * @param sortConfig - The sort configuration to validate.
   * @param expectedStructure - The expected structure for the sort configuration.
   *   Defaults to { field: 'email', direction: 'asc' }.
   * @returns `true` if the sort configuration is valid, otherwise `false`.
   */
  function isValidSortConfig(
    sortConfig: Record<string, any>,
    expectedStructure: UsersSortType = { field: 'email', direction: 'asc' },
  ): boolean {
    // Check if the sortConfig has the expected keys
    for (const key in sortConfig) {
      const isValidConfig = Object.keys(sortConfig[key]).every((key) =>
        Object.prototype.hasOwnProperty.call(expectedStructure, key),
      )
      if (!isValidConfig) return false
    }
    return true
  }

  const toggleSort = (field: 'email' | 'roles' | 'title' | 'id') => {
    if (sorts.value.field === field) {
      saveOrUpdate({
        field,
        ...(sortDirection.value[field] === 'asc' ? { direction: 'desc' } : {}),
      })
    } else {
      saveOrUpdate({
        field,
        direction: 'asc',
      })
    }
  }

  return { sorts, sortDirection, loadSorts, saveOrUpdate, handleGetSortedData, toggleSort }
}
