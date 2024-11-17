<script lang="ts">
// modified version of default NuxtErrorBoundary component - https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/components/nuxt-error-boundary.ts
import { message } from 'ant-design-vue'

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
    const repeated: Record<string, number> = {}
    const isErrorExpanded = ref(false)
    const { copy } = useCopy()

    const reload = () => {
      error.value = null
      key.value++
      // destroy the toast message
      message.destroy(MESSAGE_KEY)
    }

    const navigateToHome = () => {
      error.value = null
      location.hash = '/'
      location.reload()
    }

    const close = () => {
      error.value = null
      // destroy the toast message
      message.destroy(MESSAGE_KEY)
    }

    onErrorCaptured((err) => {
      if (import.meta.client && (!nuxtApp.isHydrating || !nuxtApp.payload.serverRendered)) {
        console.error('UI Error :', err)
        emit('error', err)
        error.value = err

        repeated[err.message] = (repeated[err.message] || 0) + 1

        // reset repeated count after 30 seconds
        setTimeout(() => {
          repeated[err.message] = 0
        }, 30000)

        try {
          nuxtApp.$report(err)
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
                class: 'flex gap-3 py-1.5',
              },
              [
                h(resolveComponent('GeneralIcon'), { icon: 'error', class: 'text-2xl text-red-500 -mt-1' }),
                h('div', { class: 'text-left flex flex-col gap-1' }, [
                  h('div', { class: 'font-weight-bold' }, 'Page Loading Error'),
                  h('div', [h('span', { class: 'text-sm text-gray-500' }, 'Something went wrong while loading page!')]),
                ]),
                h(
                  'div',
                  {
                    class: 'flex gap-1 justify-end',
                  },
                  [
                    repeated[err.message] > 2
                      ? h(
                          resolveComponent('NcButton'),
                          {
                            onClick: navigateToHome,
                            type: 'text',
                            size: 'xsmall',
                            class: '!text-sm !px-2 !text-primary',
                          },
                          'Home',
                        )
                      : h(
                          resolveComponent('NcButton'),
                          {
                            onClick: reload,
                            type: 'text',
                            size: 'xsmall',
                            class: '!text-sm !px-2 !text-primary',
                          },
                          'Reload',
                        ),
                    h(
                      resolveComponent('NcButton'),
                      {
                        onClick: close,
                        type: 'text',
                        size: 'xsmall',
                        class: 'flex items-center gap-1',
                      },
                      [h(resolveComponent('GeneralIcon'), { icon: 'close', class: '' })],
                    ),
                  ],
                ),
              ],
            ),
          ]),
          duration: 5,
          style: {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
          },
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
