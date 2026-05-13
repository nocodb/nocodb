/**
 * Session-level signal that a Gantt view was just created and should open its
 * Configure dialog on first mount. Set by store/views.ts after a successful
 * Gantt view create; consumed (and cleared) by ee/components/smartsheet/gantt/index.vue
 * when the new view mounts.
 *
 * Implemented as a singleton via createSharedComposable so all callers share
 * the same in-memory queue. No persistence — a page reload between create
 * and mount drops the signal, which is correct: users who refresh shouldn't
 * be re-prompted to configure.
 */
export const useGanttSetupDialog = createSharedComposable(() => {
  const pendingViewIds = ref<Set<string>>(new Set())

  // Mark a freshly-created Gantt view as needing first-time setup.
  const enqueue = (viewId: string) => {
    pendingViewIds.value.add(viewId)
  }

  // Consume the marker — returns true if the view was queued and clears it.
  // Idempotent: subsequent calls for the same id return false.
  const consume = (viewId: string): boolean => {
    if (pendingViewIds.value.has(viewId)) {
      pendingViewIds.value.delete(viewId)
      return true
    }
    return false
  }

  return { enqueue, consume }
})
