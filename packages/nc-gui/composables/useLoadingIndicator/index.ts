interface UseLoadingIndicatorProps {
  duration?: number
  throttle?: number
}

export function useLoadingIndicator({ duration = 2000, throttle = 200 }: UseLoadingIndicatorProps) {
  const progress = ref(0)
  const isLoading = ref(false)
  const step = computed(() => 10000 / duration)

  let _timer: any = null
  let _throttle: any = null

  function start() {
    clear()
    progress.value = 0
    isLoading.value = true
    if (throttle) {
      if (import.meta.client) {
        _throttle = setTimeout(_startTimer, throttle)
      }
    } else {
      _startTimer()
    }
  }

  function finish() {
    progress.value = 100
    _hide()
  }

  function clear() {
    clearInterval(_timer)
    clearTimeout(_throttle)
    _timer = null
    _throttle = null
  }

  function _increase(num: number) {
    progress.value = Math.min(100, progress.value + num)
  }

  function _hide() {
    clear()
    if (import.meta.client) {
      setTimeout(() => {
        isLoading.value = false
        setTimeout(() => {
          progress.value = 0
        }, 400)
      }, 500)
    }
  }

  function _startTimer() {
    if (import.meta.client) {
      _timer = setInterval(() => {
        _increase(step.value)
      }, 100)
    }
  }

  return {
    progress,
    isLoading,
    start,
    finish,
    clear,
  }
}
