export interface UserObject {
  id?: string
  email?: string
  display_name?: string
}

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
      const src = iframe.getAttribute('src')

      if (!src || src === 'about:blank' || src.startsWith('data:') || src.startsWith('blob:')) {
        return null
      }

      const url = new URL(src, window.location.origin)
      if (url.origin === 'https://app.nocodb.com') {
        return url.origin
      }
      return null
    } catch (error) {
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

        if (!targetOrigin) {
          return
        }

        iframe.contentWindow?.postMessage(
          {
            type: MESSAGE_TYPE,
            user: userObj,
          },
          targetOrigin,
        )
      } catch (error) {
        console.warn('Failed to send user data to iframe:', error)
      }
    })
  }

  // IFRAME MODE: Listen for user data
  if (isIFrame) {
    window.addEventListener('message', (event) => {
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
