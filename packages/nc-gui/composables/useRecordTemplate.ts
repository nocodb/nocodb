const showRecordTemplateManager = ref(false)

export function useRecordTemplate() {
  const openManager = () => {
    showRecordTemplateManager.value = true
  }

  return {
    showRecordTemplateManager,
    openManager,
  }
}
