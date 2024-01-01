import rfdc from 'rfdc'
import type { UsersSortType } from '~/lib'
import { useGlobal } from '#imports'

/**
 * Hook for managing user sorts and sort configurations.
 * @returns An object containing reactive values and functions related to user sorts.
 */
export function useUserSorts() {
  const clone = rfdc()

  const { user } = useGlobal()

  const sorts = ref<UsersSortType[]>([])

  // Key for storing user sort configurations in local storage
  const userSortConfigKey = 'userSortConfig'

  // Default user ID if no user found (fallback)
  const defaultUserId = 'default'

  /**
   * Computed property that returns a record of sort directions based on the current sort configurations.
   * @type {ComputedRef<Record<string, UsersSortType['direction']>>}
   */
  const sortDirection: ComputedRef<Record<string, UsersSortType['direction']>> = computed(() => {
    return sorts.value.reduce((acc, curr) => {
      acc = { ...acc, [curr.field]: curr.direction }
      return acc
    }, {} as Record<string, UsersSortType['direction']>)
  })

  /**
   * Loads user sort configurations from local storage based on the current user ID.
   */
  function loadSorts(): void {
    try {
      // Retrieve sort configuration from local storage
      const storedConfig = localStorage.getItem(userSortConfigKey)

      const sortConfig = storedConfig ? JSON.parse(storedConfig) : {}
      sorts.value = sortConfig

      // Load user-specific sort configurations or default configurations
      sorts.value = user.value?.id ? sortConfig[user.value.id] || [] : sortConfig[defaultUserId] || []
    } catch (error) {
      console.error('Error while retrieving sort configuration from local storage:', error)
      // Set sorts to an empty array in case of an error
      sorts.value = []
    }
  }

  /**
   * Saves or updates a user sort configuration and updates local storage.
   * @param {UsersSortType} newSortConfig - The new sort configuration to save or update.
   */
  function saveOrUpdate(newSortConfig: UsersSortType): void {
    try {
      const fieldIndex = sorts.value.findIndex((sort) => sort.field === newSortConfig.field)
      if (newSortConfig.direction) {
        if (fieldIndex !== -1) {
          // Update the direction if the field exists
          sorts.value = [
            ...clone(sorts.value)
              .map((sort) => {
                if (sort.field === newSortConfig.field) {
                  sort.direction = newSortConfig.direction
                }
                return sort
              })
              .filter((sort) => sort.field !== newSortConfig.field), // For now it is only single level of sorting so remove another sort field
          ]
        } else {
          // Add a new sort configuration
          sorts.value = [newSortConfig]
        }
      } else {
        if (fieldIndex !== -1) {
          // Remove the sort configuration if the field exists and direction is not present
          sorts.value = [...clone(sorts.value).filter((sort) => sort.field !== newSortConfig.field)]
        }
      }

      // Update local storage with the new sort configurations
      const storedConfig = localStorage.getItem(userSortConfigKey)
      const sortConfig = storedConfig ? JSON.parse(storedConfig) : {}

      if (user.value?.id) {
        // Save or delete user-specific sort configurations
        if (sorts.value.length) {
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
      console.error('Error while retrieving sort configuration from local storage:', error)
    }
  }

  /**
   * Sorts and returns a deep copy of an array of objects based on the provided sort configurations.
   *
   * @param data - The array of objects to be sorted.
   * @param sortsConfig - The array of sort configurations.
   * @returns A new array containing sorted objects.
   * @template T - The type of objects in the input array.
   */
  function handleGetSortsData<T extends Record<string, any>>(data: T[], sortsConfig: UsersSortType[] = sorts.value): T[] {
    const sortedData = clone(data).sort((a, b) => {
      let sortCondition = 0

      for (const { field, direction } of sortsConfig) {
        if (!a[field]) continue

        if (direction === 'asc') {
          sortCondition = sortCondition || a[field]?.localeCompare(b[field])
        } else if (direction === 'desc') {
          sortCondition = sortCondition || b[field]?.localeCompare(a[field])
        }
      }

      return sortCondition
    })

    return sortedData
  }

  return { sorts, sortDirection, loadSorts, saveOrUpdate, handleGetSortsData }
}
