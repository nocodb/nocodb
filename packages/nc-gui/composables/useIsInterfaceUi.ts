/**
 * Whether this subtree renders inside an interface surface.
 *
 * The viz runtime is recognised by its data adapter (`InterfacePageDataInj`),
 * but the builder's properties panel sits outside that tree and still hosts
 * interface UI — its "Edit field" mounts the same column editor the canvas
 * header does — so it flags itself with `IsInterfaceUiInj` instead. Chrome that
 * differs between the interface and the classic data app (e.g. `NcColorPanel`
 * over the legacy picker) must honour both, or the same editor renders
 * differently depending on which affordance opened it.
 */
export function useIsInterfaceUi() {
  const interfacePageDataApi = inject(InterfacePageDataInj, undefined)

  const isInterfaceUi = inject(IsInterfaceUiInj, ref(false))

  return computed(() => !!interfacePageDataApi || isInterfaceUi.value)
}
