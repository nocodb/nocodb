export function useDashboard() {
  const dashboardUrl = computed(() => {
    return location.origin
  })

  return { dashboardUrl }
}
