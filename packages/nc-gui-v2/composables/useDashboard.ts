export default () => {
  const route = useRoute()
  const dashboardUrl = computed(() => {
    // todo: test in different scenarios
    // get base path of app
    return `${location.origin}${(location.pathname || '').replace(route.path, '')}`
  })

  return { dashboardUrl }
}
