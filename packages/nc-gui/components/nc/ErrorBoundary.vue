<script lang="ts">
// modified version of default NuxtErrorBoundary component - https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/components/nuxt-error-boundary.ts
import { message } from 'ant-design-vue'

const MESSAGE_KEY = 'ErrorMessageKey'

/**
 * Vue's own renderer throwing while it tears a tree down, e.g.
 * `TypeError: Cannot read properties of null (reading 'subTree')` from `move`.
 *
 * The app has a single <Suspense> (Nuxt's root one — see nuxt-root.vue), so
 * every `Lazy*` component in the app is one of its deps. Its `resolve()`
 * unmounts the leaving branch while `pendingBranch` is still set, and an
 * unresolved dep inside that branch decrements `deps` to 0 and re-enters
 * `resolve()` — which then `move()`s a half-unmounted tree whose
 * `vnode.component` is already null. A local <Suspense> is immune (its
 * `unmount` sets `isUnmounted` first, which the guard checks); the root one
 * never unmounts, so it isn't.
 *
 * None of it is recoverable in place: the patch aborted mid-teardown, so the
 * DOM is already gone — which is why only a browser refresh clears it. Rebuild
 * the page tree instead, and don't tell the user about a transient race.
 */
function isRendererTeardownError(err: any) {
  // Matched on the message alone, and on `subTree` alone:
  //  - no stack check — production stacks carry minified chunk names, so there
  //    is no `runtime-core` frame to look for and the guard would only ever
  //    match in dev, which is exactly backwards.
  //  - `subTree` is a Vue internal that app code never reads. Widening this to
  //    'el' / 'parentNode' would also swallow our own null-ref bugs, which have
  //    to keep surfacing. Add signatures when one is actually observed.
  return err instanceof TypeError && /reading 'subTree'/.test(err.message ?? '')
}

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
      window.location.href = '/'
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

        // Self-heal the renderer race — remount instead of leaving a blank page.
        // Only on the FIRST hit of a signature: a repeat means the rebuild ran
        // into the same error, so fall through to the toast rather than loop.
        // Deferred a macrotask to leave the failing patch first (the same trick
        // the interface shells use for their redirects).
        if (isRendererTeardownError(err) && repeated[err.message] === 1) {
          setTimeout(reload, 0)

          return false
        }

        // destroy any previous toast message to avoid duplicate messages
        message.destroy(MESSAGE_KEY)

        ncMessage.error(
          {
            key: MESSAGE_KEY,
            title: 'Page Loading Error',
            content: 'Something went wrong while loading page!',
            action:
              repeated[err.message] > 2
                ? h(
                    resolveComponent('NcButton'),
                    {
                      onClick: navigateToHome,
                      type: 'text',
                      size: 'xsmall',
                      class: '!text-sm !px-2 !text-nc-content-brand',
                    },
                    () => 'Home',
                  )
                : h(
                    resolveComponent('NcButton'),
                    {
                      onClick: reload,
                      type: 'text',
                      size: 'xsmall',
                      class: '!text-sm !px-2 !text-nc-content-brand',
                    },
                    () => 'Reload',
                  ),
            onClose: close,
            class: '!w-auto !max-w-[fit-content]',
            showDuration: true,
            showCopyBtn: false,
          },
          5,
        )

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
