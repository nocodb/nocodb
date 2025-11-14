<script lang="ts" setup>
import type { FormBuilderElement } from 'nocodb-sdk'

const props = defineProps<{
  value: {
    code_verifier: string
    code: string
  }
  element: FormBuilderElement
  haveValue?: boolean
  formData?: Record<string, any>
}>()

const emits = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emits)

const OAuthConfig = computed(() => {
  return props.element.oauthMeta!
})

const generateState = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

// Generate PKCE code verifier (43-128 characters)
const generateCodeVerifier = () => {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

// Generate PKCE code challenge (SHA256 hash of verifier)
const generateCodeChallenge = async (verifier: string) => {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

const openPopup = (url: string, name: string, state: string, codeVerifier: string, width = 500, height = 600) => {
  const left = window.screenX + (window.outerWidth - width) / 2
  const top = window.screenY + (window.outerHeight - height) / 2.5

  // add state to the URL
  url += `&state=${state}`

  const popup = window.open(url, name, `width=${width},height=${height},left=${left},top=${top}`)
  if (!popup) throw new Error('Popup blocked')

  return new Promise<{ code: string; codeVerifier: string } | null>((resolve, reject) => {
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
        if (url.includes(OAuthConfig.value.redirectUri)) {
          const params = new URL(url).searchParams
          const code = params.get(OAuthConfig.value.codeKey || 'code')
          if (code) {
            clearInterval(interval)

            if (params.get('state') !== state) {
              reject(new Error('Invalid state please try again'))
            }

            popup.close()
            resolve({ code, codeVerifier })
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

// Helper to get nested value from object using dot notation
const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

// Resolve authUri by replacing template variables like {{config.subdomain}}
const getResolvedAuthUri = computed(() => {
  let url = OAuthConfig.value.authUri

  if (!url || !props.formData) return url

  // Replace all {{path.to.value}} with actual values from formData
  url = url.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const value = getNestedValue(props.formData, path.trim())
    return value !== undefined && value !== null ? String(value) : match
  })

  return url
})

const handleOAuth = async () => {
  let url = getResolvedAuthUri.value

  // Check if URL still has unresolved templates
  if (url.includes('{{') && url.includes('}}')) {
    message.error('Please fill in all required fields before authenticating')
    return
  }

  // Check if URL is empty or invalid
  if (!url || url.trim() === '') {
    message.error('Please fill in all required fields before authenticating')
    return
  }

  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  url += `&code_challenge=${codeChallenge}&code_challenge_method=S256`

  const result = await openPopup(url, `${OAuthConfig.value.provider} OAuth`, generateState(), codeVerifier, 500, 600)

  if (!result) {
    message.error('Failed to authenticate using OAuth')
    return
  }

  vModel.value = {
    code: result.code,
    code_verifier: result.codeVerifier,
  }
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
