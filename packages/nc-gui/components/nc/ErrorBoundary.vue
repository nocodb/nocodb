<script lang="ts">
// modified version of default NuxtErrorBoundary component - https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/components/nuxt-error-boundary.ts
import { message } from 'ant-design-vue'
import * as Sentry from '@sentry/vue'

const MESSAGE_KEY = 'ErrorMessageKey'

export default {
  emits: {
    error(_error: unknown) {
      return true
    },
  },
  setup(_props, { emit }) {
    const nuxtApp = useNuxtApp()
    const error = ref()
    const prevError = ref()
    const errModal = computed(() => !!error.value)
    const key = ref(0)
    const isErrorExpanded = ref(false)
    const { copy } = useCopy()

    const reload = () => {
      prevError.value = error.value
      error.value = null
      key.value++
    }

    const navigateToHome = () => {
      prevError.value = error.value
      error.value = null
      location.hash = '/'
      location.reload()
    }

    onErrorCaptured((err) => {
      if (import.meta.client && (!nuxtApp.isHydrating || !nuxtApp.payload.serverRendered)) {
        console.error('UI Error :', err)
        emit('error', err)
        error.value = err

        try {
          Sentry.captureException(err)
        } catch {
          // ignore
        }
        // destroy any previous toast message to avoid duplicate messages
        message.destroy(MESSAGE_KEY)

        message.open({
          key: MESSAGE_KEY,
          content: h('div', [
            h(
              'div',
              {
                class: 'flex items-center gap-2',
              },
              [
                h(resolveComponent('GeneralIcon'), { icon: 'error', class: 'text-2xl text-red-500' }),
                h('div', { class: 'text-left' }, [
                  h('div', { class: 'font-weight-bold' }, 'Error'),
                  h('div', [h('span', 'Some error occurred while loading the page. Please reload.')]),
                ]),
                h(
                  'div',
                  {
                    class: 'flex items-center gap-1 justify-end',
                  },
                  [
                    h(
                      resolveComponent('NcButton'),
                      {
                        onClick: reload,
                        type: 'secondary',
                        size: 'small',
                      },
                      'Reload',
                    ),
                    h(
                      resolveComponent('NcButton'),
                      {
                        onClick: navigateToHome,
                        type: 'secondary',
                        size: 'small',
                        class: 'flex items-center gap-1',
                      },
                      'Home',
                    ),
                  ],
                ),
              ],
            ),
          ]),
          duration: 10,
          // type: 'error',
          // prefixCls?: string;
          // rootPrefixCls?: string;
          // getPopupContainer?: (triggerNode: HTMLElement) => HTMLElement;
          // style?: CSSProperties;
          // class?: string;
          // onClick?: (e: MouseEvent) => void;
        })
        return false
      }
    })

    const copyError = async () => {
      try {
        if (error.value) await copy(`message: ${error.value.message}\n\n${error.value.stack}`)
        message.info('Error message copied to clipboard.')
      } catch (e) {
        message.error('Something went wrong while copying to clipboard, please copy from browser console.')
      }
    }

    return {
      errModal,
      error,
      key,
      isErrorExpanded,
      prevError,
      copyError,
      reload,
      navigateToHome,
    }
  },
}
</script>

<template>
  <slot :key="key"></slot>
</template>
