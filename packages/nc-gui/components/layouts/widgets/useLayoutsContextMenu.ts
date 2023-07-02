export default function useLayoutsContextMenu() {
  const isContextMenuVisible = ref(false)

  const contextMenuRef = ref<HTMLElement | null>(null)
  const showContextMenuButtonRef = ref<HTMLElement | null>(null)

  const handleDocumentClick = (event: MouseEvent) => {
    if (
      !contextMenuRef.value?.contains(event.target as Node) &&
      !showContextMenuButtonRef.value?.contains(event.target as Node)
    ) {
      isContextMenuVisible.value = false
    }
  }

  onMounted(() => {
    document.addEventListener('click', handleDocumentClick)
  })
  onUnmounted(() => {
    document.removeEventListener('click', handleDocumentClick)
  })

  const showContextMenu = () => {
    isContextMenuVisible.value = true
  }

  return { showContextMenu, isContextMenuVisible, contextMenuRef, showContextMenuButtonRef }
}
