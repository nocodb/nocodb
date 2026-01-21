export const useIsMounted = (options: { waitForNextTick?: boolean } = {}) => {
  const isMounted = ref(false)

  onMounted(async () => {
    if (options.waitForNextTick) {
      await nextTick()
    }

    isMounted.value = true
  })

  onBeforeUnmount(() => {
    isMounted.value = false
  })

  return { isMounted }
}
