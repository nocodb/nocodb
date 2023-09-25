import { createGlobalState, ref } from '#imports'

export const useApiTiming = createGlobalState(() => {
  const timing = ref<any>()

  const setTiming = (value: any) => {
    timing.value = value
  }

  return { timing, setTiming }
})
