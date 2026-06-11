import { useStorage } from '@vueuse/core'

interface UseSidebarProps {
  hasSidebar?: boolean
  isOpen?: boolean
  useStorage?: boolean
}

/**
 * States for sidebars
 *
 * Requires an id to work, id should correspond to the sidebar state you want to create or fetch
 * If `useSidebar` was not called before it will create a new state if no state can be found for the specified id
 */
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
    const storage = toRefs(
      useStorage(id, { isOpen: isOpen.value, hasSidebar: hasSidebar.value }, localStorage, { mergeDefaults: true }).value,
    )
    isOpen.value = storage.isOpen.value
    hasSidebar.value = storage.hasSidebar.value

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

const leftSidebar = createSharedComposable(() => createSidebar('leftSidebar'))

const rightSidebar = createSharedComposable(() =>
  createSidebar('rightSidebar', { useStorage: true, isOpen: true, hasSidebar: true }),
)

export const useSidebar = (id: string, props: UseSidebarProps = {}) => {
  const sidebar = id.includes('left') ? leftSidebar() : rightSidebar()

  if (props.isOpen !== undefined) sidebar.isOpen.value = props.isOpen
  if (props.hasSidebar !== undefined) sidebar.hasSidebar.value = props.hasSidebar

  return sidebar
}

export const useLeftSidebar = (props: UseSidebarProps = {}) => useSidebar('left', props)

export const useRightSidebar = (props: UseSidebarProps = {}) => useSidebar('right', props)
