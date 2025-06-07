const onVisibilityChange = (visible) => {
  if (visible) {
    addColumnDropdown.value = true
  } else {
    const shouldKeepOpen = editOrAddProviderRef.value?.shouldKeepModalOpen()
    
    if (!shouldKeepOpen) {
      if (editOrAddProviderRef.value) {
        editOrAddProviderRef.value.handleCancel()
      } else {
        addColumnDropdown.value = false
      }
    } else {
      addColumnDropdown.value = true
    }
  }
}
