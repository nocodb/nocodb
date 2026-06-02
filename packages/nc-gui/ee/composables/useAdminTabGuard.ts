/**
 * Lets an admin tab (e.g. White Label) register an async confirm that runs
 * before the admin panel switches away from it. Admin tabs are swapped via an
 * `activeTab` ref (not a route), so `onBeforeRouteLeave` doesn't fire on a
 * tab switch — the parent consults this guard instead.
 *
 * The registered fn resolves `true` to allow leaving, `false` to stay.
 */
export const useAdminTabGuard = createSharedComposable(() => {
  const leaveGuard = ref<(() => Promise<boolean>) | null>(null)

  return { leaveGuard }
})
