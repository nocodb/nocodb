import { computed, useRouter } from '#imports'

export function useDashboard() {
  const router = useRouter()

  const route = $(router.currentRoute)

  const dashboardUrl = computed(() => {
    // todo: test in different scenarios
    // get base path of app
    return `${location.origin}${(location.pathname || '').replace(route.path, '')}`
  })

  return { dashboardUrl }
}
