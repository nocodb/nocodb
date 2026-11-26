export function useDashboard() {
  const dashboardUrl = computed(() => {
    return ncAppUrl()
  })

  return { dashboardUrl }
}
