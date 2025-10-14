import { onMounted, onUnmounted, ref, watch } from 'vue'

export interface UserObject {
  id?: string
  email?: string
  display_name?: string
}

export const useUserSync = createSharedComposable(() => {
  const isIFrame = ncIsIframe()
  const { user } = useGlobal()
  const currentUser = ref<UserObject | null>(null)
  let syncInterval: NodeJS.Timeout | null = null

  const sendToAllIframes = () => {
    const userObj = {
      id: user.value?.id,
      email: user.value?.email,
      display_name: user.value?.display_name,
    }

    document.querySelectorAll('iframe').forEach((iframe) => {
      try {
        iframe.contentWindow?.postMessage(
          {
            type: '___NC_USER_SYNC',
            user: userObj,
          },
          '*',
        )
      } catch (error) {
        console.warn('Failed to send user data to iframe:', error)
      }
    })
  }

  // IFRAME MODE: Listen for user data
  if (isIFrame) {
    window.addEventListener('message', (event) => {
      if (event.data.type === '___NC_USER_SYNC') {
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
