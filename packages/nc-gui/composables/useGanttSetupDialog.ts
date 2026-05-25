// CE stub for the Gantt setup-dialog signal composable.
//
// Gantt view is EE-only — the actual setup-dialog queue lives in
// ee/composables/useGanttSetupDialog.ts. This stub exists so the
// CE build's `store/views.ts` (which calls `useGanttSetupDialog()`
// inside a `form.type === ViewTypes.GANTT` guard) can resolve the
// symbol at build time. The guard is unreachable in pure-CE — Gantt
// view creation is gated behind the EE plan — but a missing import
// would still break CE compilation.
//
// Keep the surface aligned with the EE implementation.
export const useGanttSetupDialog = createSharedComposable(() => {
  return {
    enqueue: (_viewId: string) => {},
    consume: (_viewId: string): boolean => false,
  }
})
