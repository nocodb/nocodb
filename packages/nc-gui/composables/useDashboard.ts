export function useDashboard() {
  const router = useRouter()

  const dashboardUrl = computed(() => {
    const base = (router.options.history?.base || '/').replace(/\/+$/, '')
    return `${location.origin}${base}`
  })

  return { dashboardUrl }
}
