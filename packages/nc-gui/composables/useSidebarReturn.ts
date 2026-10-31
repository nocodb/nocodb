interface SidebarReturn {
  baseId: string
  path: string
  label: string
}

/**
 * The table page a topbar popover opened a workflow, script, agent or chat from,
 * so the topbar can offer Back while the sidebar shows Workflows or Agents.
 */
export const useSidebarReturn = createSharedComposable(() => {
  const route = useRoute()

  const { activeSidebarTab } = storeToRefs(useSidebarStore())

  const returnTo = ref<SidebarReturn | null>(null)

  // Armed by a popover before it navigates; kept only if the next navigation leaves the data tab from this page.
  let pending: SidebarReturn | null = null

  const isReturnVisible = computed(() => !!returnTo.value && activeSidebarTab.value !== 'data')

  function rememberReturn(label: string) {
    if (returnTo.value) return
    pending = { baseId: route.params.baseId as string, path: route.fullPath, label }
  }

  function clearReturn() {
    returnTo.value = null
    pending = null
  }

  // Cleared by the route watch once the table opens; a leave guard that keeps the user here keeps Back too.
  async function goBack() {
    if (returnTo.value) await navigateTo(returnTo.value.path)
  }

  watch(
    () => route.fullPath,
    async (_to, from) => {
      // The sidebar store derives the tab from the route in its own watcher.
      await nextTick()
      const armed = pending
      pending = null

      const baseId = route.params.baseId as string
      if (activeSidebarTab.value === 'data' || (returnTo.value && returnTo.value.baseId !== baseId)) {
        returnTo.value = null
        return
      }
      if (armed && !returnTo.value && armed.path === from && armed.baseId === baseId) returnTo.value = armed
    },
  )

  return { returnTo, isReturnVisible, rememberReturn, clearReturn, goBack }
})
