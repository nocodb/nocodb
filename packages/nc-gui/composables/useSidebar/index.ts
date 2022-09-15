import { useStorage } from '@vueuse/core'
import { MemStorage, useInjectionState, watch } from '#imports'

interface UseSidebarProps {
  hasSidebar?: boolean
  isOpen?: boolean
  useStorage?: boolean
}

/**
 * Injection state for sidebars
 *
 * Use `provideSidebar` to provide the injection state on current component level (will affect all children injections)
 * Use `useSidebar` to use the injection state on current component level
 *
 * If `provideSidebar` is not called explicitly, `useSidebar` will trigger the provider if no injection state can be found
 */
const [setupSidebarStore, useSidebarStore] = useInjectionState(() => new MemStorage(), 'SidebarStore')

const createSidebar = (id: string, props: UseSidebarProps = {}) => {
  const isOpen = ref(props.isOpen ?? false)
  const hasSidebar = ref(props.hasSidebar ?? true)

  function toggle(state?: boolean) {
    isOpen.value = state ?? !isOpen.value
  }

  function toggleHasSidebar(state?: boolean) {
    hasSidebar.value = state ?? !hasSidebar.value
  }

  if (props.useStorage) {
    const storage = toRefs(useStorage(id, { isOpen, hasSidebar }, localStorage, { mergeDefaults: true }).value)
    syncRef(isOpen, storage.isOpen)
    syncRef(hasSidebar, storage.hasSidebar)
  }

  watch(
    hasSidebar,
    (nextHasSidebar) => {
      if (!nextHasSidebar) toggle(false)
    },
    { immediate: true },
  )

  watch(
    isOpen,
    (nextIsOpen) => {
      if (nextIsOpen && !hasSidebar.value) toggleHasSidebar(true)
    },
    { immediate: true },
  )

  return {
    isOpen,
    toggle,
    hasSidebar,
    toggleHasSidebar,
  }
}

const useSidebarStorage = () => {
  let sidebarStorage = useSidebarStore()

  if (!sidebarStorage) {
    sidebarStorage = setupSidebarStore()
  }

  return sidebarStorage
}

export const provideSidebar = (id: string, props: UseSidebarProps = {}) => {
  const sidebarStorage = useSidebarStorage()

  if (!sidebarStorage.has(id)) {
    const sidebar = createSidebar(id, props)

    sidebarStorage.set(id, sidebar)

    return sidebar
  } else {
    const sidebar = sidebarStorage.get(id)

    if (props.isOpen !== undefined) sidebar.isOpen.value = props.isOpen
    if (props.hasSidebar !== undefined) sidebar.hasSidebar.value = props.hasSidebar

    return sidebar
  }
}

export function useSidebar(id: string, props: UseSidebarProps = {}) {
  if (!id) throw new Error('useSidebar requires an id')

  const sidebarStorage = useSidebarStorage()

  if (sidebarStorage.has(id)) {
    const sidebar = sidebarStorage.get(id)

    if (props.isOpen !== undefined) sidebar.isOpen.value = props.isOpen
    if (props.hasSidebar !== undefined) sidebar.hasSidebar.value = props.hasSidebar

    return sidebar
  } else {
    return provideSidebar(id, props)
  }
}
