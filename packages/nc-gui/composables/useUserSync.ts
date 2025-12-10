import { onMounted, onUnmounted, ref, watch } from 'vue'

export interface UserObject {
  id?: string
  email?: string
  display_name?: string
}

// Security: Trusted origins for postMessage communication
const TRUSTED_EXTERNAL_ORIGINS = [
  'https://docs.google.com', // Google Docs viewer for Office document preview
] as const

const MESSAGE_TYPE = '___NC_USER_SYNC' as const

export const useUserSync = createSharedComposable(() => {
  const isIFrame = ncIsIframe()
  const { user } = useGlobal()
  const currentUser = ref<UserObject | null>(null)
  let syncInterval: NodeJS.Timeout | null = null

  /**
   * Determines the appropriate target origin for an iframe
   * @param iframe - The iframe element to check
   * @returns The target origin URL, or null if iframe should be skipped
   */
  const getIframeTargetOrigin = (iframe: HTMLIFrameElement): string | null => {
    try {
      // Get iframe src attribute
      const src = iframe.getAttribute('src')

      // Skip iframes without src or with special protocols
      if (!src || src === 'about:blank' || src.startsWith('data:') || src.startsWith('blob:')) {
        return null
      }

      // Parse the URL
      const url = new URL(src, window.location.origin)

      // Check if same origin
      if (url.origin === window.location.origin) {
        return window.location.origin
      }

      // Check if trusted external origin
      if (TRUSTED_EXTERNAL_ORIGINS.includes(url.origin as any)) {
        return url.origin
      }

      // Unknown origin - skip this iframe
      console.warn('Skipping iframe with untrusted origin:', url.origin)
      return null
    } catch (error) {
      console.warn('Failed to determine iframe origin:', error)
      return null
    }
  }

  const sendToAllIframes = () => {
    const userObj = {
      id: user.value?.id,
      email: user.value?.email,
      display_name: user.value?.display_name,
    }

    document.querySelectorAll('iframe').forEach((iframe) => {
      try {
        const targetOrigin = getIframeTargetOrigin(iframe)

        // Skip iframes with untrusted or indeterminate origins
        if (!targetOrigin) {
          return
        }

        iframe.contentWindow?.postMessage(
          {
            type: MESSAGE_TYPE,
            user: userObj,
          },
          targetOrigin, // FIXED: Use specific origin instead of '*'
        )
      } catch (error) {
        console.warn('Failed to send user data to iframe:', error)
      }
    })
  }

  // IFRAME MODE: Listen for user data
  if (isIFrame) {
    window.addEventListener('message', (event) => {
      // Security: Validate origin before processing message
      const isValidOrigin =
        event.origin === window.location.origin ||
        TRUSTED_EXTERNAL_ORIGINS.includes(event.origin as any)

      if (!isValidOrigin) {
        console.warn('Rejected user sync message from untrusted origin:', event.origin)
        return
      }

      if (event.data.type === MESSAGE_TYPE) {
        currentUser.value = event.data.user
      }
    })
  } else {
    // PARENT MODE: Set currentUser to user
    currentUser.value = user.value
    watch(
      () => user.value,
      (newUser) => {
        currentUser.value = newUser
      },
      { deep: true },
    )
  }

  // PARENT MODE: Start syncing
  onMounted(() => {
    if (!isIFrame) {
      sendToAllIframes() // Send immediately
      syncInterval = setInterval(sendToAllIframes, 5000) // Then every 5 seconds

      // Watch for user changes to send to iframes
      watch(() => user.value, sendToAllIframes, { deep: true })
    }
  })

  onUnmounted(() => {
    if (syncInterval) {
      clearInterval(syncInterval)
    }
  })

  return {
    currentUser: readonly(currentUser),
  }
})
