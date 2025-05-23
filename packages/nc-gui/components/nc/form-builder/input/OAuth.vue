<script lang="ts" setup>
import type { FormBuilderElement } from 'nocodb-sdk'

const props = defineProps<{
  value: string
  element: FormBuilderElement
  haveValue?: boolean
}>()

const emits = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emits)

const OAuthConfig = computed(() => {
  return props.element.oauthMeta!
})

const generateState = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

const openPopup = (url: string, name: string, state: string, width = 500, height = 600) => {
  const left = window.screenX + (window.outerWidth - width) / 2
  const top = window.screenY + (window.outerHeight - height) / 2.5

  // add state to the URL
  url += `&state=${state}`

  const popup = window.open(url, name, `width=${width},height=${height},left=${left},top=${top}`)
  if (!popup) throw new Error('Popup blocked')

  return new Promise<string | null>((resolve, reject) => {
    let popupClosed = false

    const interval = setInterval(() => {
      // First check if we already know the popup is closed
      if (popupClosed) {
        clearInterval(interval)
        reject(new Error('Popup closed by user'))
        return
      }

      try {
        // Try to access popup.closed, which might throw in cross-origin scenarios
        popupClosed = popup.closed
        if (popupClosed) {
          clearInterval(interval)
          reject(new Error('Popup closed by user'))
          return
        }

        const url = popup.location.href
        console.log('url', url)
        console.log('OAuthConfig.value.redirectUri', OAuthConfig.value.redirectUri)

        if (url.includes(OAuthConfig.value.redirectUri)) {
          const params = new URL(url).searchParams
          const code = params.get(OAuthConfig.value.codeKey || 'code')
          if (code) {
            clearInterval(interval)

            if (params.get('state') !== state) {
              reject(new Error('Invalid state please try again'))
            }

            popup.close()
            resolve(code)
          } else {
            reject(new Error('No code returned'))
          }
        }
      } catch (e) {
        // Handle cross-origin errors
        // If we get an error accessing popup properties, check if we can detect it's closed
        try {
          // This might also throw, but worth trying
          popupClosed = popup.closed
          if (popupClosed) {
            clearInterval(interval)
            reject(new Error('Popup closed by user'))
          }
        } catch {
          // Completely swallow the error - we'll keep checking
        }
      }
    }, 500)
  })
}

const handleOAuth = async () => {
  const url = OAuthConfig.value.authUri
  const code = await openPopup(url, `${OAuthConfig.value.provider} OAuth`, generateState(), 500, 600)

  if (!code) {
    message.error('Failed to authenticate using OAuth')
    return
  }

  vModel.value = code
}
</script>

<template>
  <div>
    <NcButton type="primary" @click="handleOAuth">
      <div class="flex items-center gap-2">
        <div class="font-bold">Authenticate With {{ OAuthConfig.provider }}</div>
        <template v-if="haveValue">
          <GeneralIcon icon="circleCheckSolid" class="text-success w-6 h-6 bg-white-500" />
        </template>
      </div>
    </NcButton>
  </div>
</template>

<style></style>
