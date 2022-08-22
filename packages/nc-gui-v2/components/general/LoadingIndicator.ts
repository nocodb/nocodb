import { watch } from 'vue'
import { computed, defineComponent, h, onBeforeUnmount, ref, useNuxtApp } from '#imports'

export function useLoadingIndicator(opts: { duration: number; throttle: number }) {
  const progress = ref(0)
  const isLoading = ref(false)
  const step = computed(() => 10000 / opts.duration)

  let _timer: any = null
  let _throttle: any = null

  function start() {
    clear()
    progress.value = 0
    isLoading.value = true
    if (opts.throttle) {
      if (process.client) {
        _throttle = setTimeout(_startTimer, opts.throttle)
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
    if (process.client) {
      setTimeout(() => {
        isLoading.value = false
        setTimeout(() => {
          progress.value = 0
        }, 400)
      }, 500)
    }
  }

  function _startTimer() {
    if (process.client) {
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

export default defineComponent({
  name: 'LoadingIndicator',
  props: {
    throttle: {
      type: Number,
      default: 200,
    },
    duration: {
      type: Number,
      default: 2000,
    },
    height: {
      type: Number,
      default: 3,
    },
    color: {
      type: String,
      default: 'repeating-linear-gradient(to right,#00dc82 0%,#34cdfe 50%,#0047e1 100%)',
    },
  },
  setup(props) {
    const indicator = useLoadingIndicator({
      duration: props.duration,
      throttle: props.throttle,
    })

    // Hook to app lifecycle
    // TODO: Use unified loading API
    const nuxtApp = useNuxtApp()
    nuxtApp.hook('page:start', indicator.start)
    nuxtApp.hook('page:finish', indicator.finish)

    watch(nuxtApp.$state.isLoading, (isLoading, _, onCleanup) => {
      if (isLoading) {
        indicator.start()
      } else {
        indicator.finish()
      }

      onCleanup(() => indicator.clear)
    })

    onBeforeUnmount(() => indicator.clear)

    return () =>
      h('div', {
        class: 'nuxt-loading-indicator',
        style: {
          position: 'fixed',
          top: 0,
          right: 0,
          left: 0,
          pointerEvents: 'none',
          width: `${indicator.progress.value}%`,
          height: `${props.height}px`,
          opacity: indicator.isLoading.value ? 1 : 0,
          background: props.color,
          backgroundSize: `${(100 / indicator.progress.value) * 100}% auto`,
          transition: 'width 0.1s, height 0.4s, opacity 0.4s',
          zIndex: 999999,
        },
      })
  },
})
