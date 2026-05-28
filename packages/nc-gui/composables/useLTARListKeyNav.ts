import type { Ref } from 'vue'

interface UseLTARListKeyNavOptions {
  scrollContainerRef: Ref<HTMLElement | undefined>
  filterQueryRef: Ref<HTMLInputElement | undefined>
  itemTestId: string
  expandedFormDlg: Ref<boolean>
  closeModal: () => void
  getQuery: () => string
  onEscapeEmptyQuery: () => void
  onEnterWithQuery: () => void
}

export function useLTARListKeyNav(options: UseLTARListKeyNavOptions) {
  const {
    scrollContainerRef,
    filterQueryRef,
    itemTestId,
    expandedFormDlg,
    closeModal,
    getQuery,
    onEscapeEmptyQuery,
    onEnterWithQuery,
  } = options

  function getItems(): HTMLElement[] {
    const container = scrollContainerRef.value
    if (!container) return []
    return Array.from(container.querySelectorAll<HTMLElement>(`[data-testid="${itemTestId}"]`))
  }

  function focusListItemByIndex(idx: number) {
    const wrapper = getItems()[idx]
    const focusable = wrapper?.querySelector<HTMLElement>('[tabindex="0"]') ?? wrapper
    focusable?.focus()
  }

  function onWindowKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      closeModal()
      return
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const target = e.target as HTMLElement | null
      const currentWrapper = target?.closest<HTMLElement>(`[data-testid="${itemTestId}"]`)
      if (!currentWrapper || !scrollContainerRef.value) return

      e.preventDefault()

      const items = getItems()
      const idx = items.indexOf(currentWrapper)
      if (idx === -1) return

      if (e.key === 'ArrowDown') {
        if (idx < items.length - 1) focusListItemByIndex(idx + 1)
      } else if (idx === 0) {
        filterQueryRef.value?.focus()
      } else {
        focusListItemByIndex(idx - 1)
      }
      return
    }

    if (!expandedFormDlg.value && e.key !== 'Tab' && e.key !== 'Shift' && e.key !== 'Enter' && e.key !== ' ') {
      try {
        filterQueryRef.value?.focus()
      } catch {}
    }
  }

  function handleSearchKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (!getQuery()) onEscapeEmptyQuery()
      filterQueryRef.value?.blur()
    } else if (e.key === 'Enter') {
      if (getQuery()) onEnterWithQuery()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusListItemByIndex(0)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', onWindowKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', onWindowKeydown)
  })

  return { handleSearchKeydown }
}
