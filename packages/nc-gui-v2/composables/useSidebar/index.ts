import { useInjectionState, useToggle, watch } from '#imports'

interface UseSidebarProps {
  hasSidebar?: boolean
  isOpen?: boolean
}

/**
 * Injection state for sidebars
 *
 * Use `provideSidebar` to provide the injection state on current component level (will affect all children injections)
 * Use `useSidebar` to use the injection state on current component level
 *
 * If `provideSidebar` is not called explicitly, `useSidebar` will trigger the provider if no injection state can be found
 */
const [setup, use] = useInjectionState((props: UseSidebarProps = {}) => {
  const [isOpen, toggle] = useToggle(props.isOpen ?? false)
  const [hasSidebar, toggleHasSidebar] = useToggle(props.hasSidebar ?? true)

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
}, 'useSidebar')

export const provideSidebar = setup

export function useSidebar(props: UseSidebarProps = {}) {
  const state = use()

  if (!state) {
    return setup(props)
  } else {
    // set state if props were passed
    if (typeof props.isOpen !== 'undefined') state.isOpen.value = props.isOpen
    if (typeof props.hasSidebar !== 'undefined') state.hasSidebar.value = props.hasSidebar
  }

  return state
}
