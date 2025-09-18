<script setup lang="ts">
definePageMeta({
  requiresAuth: true,
})

const route = useRoute()

const { api } = useApi()
const { $api } = useNuxtApp()
const { user } = useGlobal()

const { getPossibleAttachmentSrc } = useAttachment()

const clientId = computed(() => route.query.client_id as string)
const redirect_uri = computed(() => route.query.redirect_uri as string)
const responseType = computed(() => route.query.response_type as string)
const state = computed(() => route.query.state as string)

const loading = ref(true)
const error = ref('')
const authorizing = ref(false)
const clientInfo = ref<any>({})

const isValidRequest = computed(() => {
  return clientId.value && redirect_uri.value && responseType.value === 'code'
})

async function loadAuthorizationRequest() {
  if (!isValidRequest.value) {
    error.value = 'Invalid OAuth request parameters'
    loading.value = false
    return
  }

  try {
    const response = await api.oAuth.v2PublicOauthClientDetail(clientId.value)

    if (!response.redirect_uris.includes(redirect_uri.value)) {
      error.value = 'Invalid redirect URI'
      return
    }

    clientInfo.value = response
  } catch (err: any) {
    console.error('Failed to load client info:', err)
    if (err.response?.status === 404) {
      error.value = 'Application not found'
    } else {
      error.value = 'Failed to load application information'
    }
  } finally {
    loading.value = false
  }
}

async function approveAuthorization() {
  authorizing.value = true

  try {
    const response = await $api.oauth.authorize({
      client_id: clientId.value,
      redirect_uri: redirect_uri.value,
      state: state.value,
      approved: true,
    })

    window.location.href = response.redirect_url
  } catch (err: any) {
    console.error('Authorization failed:', err)
    error.value = 'Authorization failed. Please try again.'
  } finally {
    authorizing.value = false
  }
}

function denyAuthorization() {
  const errorUrl = new URL(redirect_uri.value)
  errorUrl.searchParams.set('error', 'access_denied')
  errorUrl.searchParams.set('error_description', 'User denied the request')
  if (state.value) {
    errorUrl.searchParams.set('state', state.value)
  }

  window.location.href = errorUrl.toString()
}

onMounted(() => {
  loadAuthorizationRequest()
})
</script>

<template>
  <div class="oauth-authorize-page min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <!-- Loading State -->
    <div v-if="loading" class="text-center">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
      <p class="text-gray-600">Loading authorization request...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
      <GeneralIcon icon="alertTriangle" class="w-12 h-12 text-red-500 mx-auto mb-4" />
      <h2 class="text-xl font-semibold text-gray-900 mb-2">Authorization Error</h2>
      <p class="text-gray-600 mb-6">{{ error }}</p>
      <NcButton type="secondary" @click="$router.push('/')"> Back to NocoDB </NcButton>
    </div>

    <!-- Authorization Request -->
    <div v-else class="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full">
      <!-- App Header -->
      <div class="flex items-start gap-4 mb-6">
        <div class="flex-shrink-0">
          <CellAttachmentPreviewImage
            v-if="clientInfo.logo_uri"
            :srcs="getPossibleAttachmentSrc(clientInfo.logo_uri)"
            class="flex-none !object-contain max-h-12 max-w-12 !rounded-lg !m-0"
            :is-cell-preview="false"
          />
          <div v-else class="w-16 h-16 rounded-lg bg-primary flex items-center justify-center text-white text-xl font-bold">
            {{ clientInfo.client_name?.charAt(0) || 'A' }}
          </div>
        </div>

        <div class="flex-1 min-w-0">
          <h1 class="text-xl font-semibold text-gray-900 truncate">
            {{ clientInfo.client_name }}
          </h1>
          <a
            v-if="clientInfo.client_uri"
            :href="clientInfo.client_uri"
            target="_blank"
            class="text-sm text-primary hover:underline"
          >
            {{ clientInfo.client_uri }}
          </a>
          <p v-if="clientInfo.client_description" class="text-sm text-gray-600 mt-1">
            {{ clientInfo.client_description }}
          </p>
        </div>
      </div>

      <!-- Authorization Message -->
      <div class="mb-6">
        <h2 class="text-lg font-medium text-gray-900 mb-3">Authorize {{ clientInfo.client_name }}?</h2>
        <p class="text-gray-600 mb-4">{{ clientInfo.client_name }} wants to access your NocoDB account.</p>

        <!-- Permissions -->
        <div class="bg-gray-50 rounded-lg p-4">
          <h3 class="font-medium text-gray-900 mb-3">This application will be able to:</h3>
          <ul class="space-y-2">
            <li class="flex items-center text-sm text-gray-700">
              <GeneralIcon icon="check" class="w-4 h-4 text-green-600 mr-2 flex-shrink-0" />
              Access your databases and tables
            </li>
            <li class="flex items-center text-sm text-gray-700">
              <GeneralIcon icon="check" class="w-4 h-4 text-green-600 mr-2 flex-shrink-0" />
              Read, create, update, and delete records
            </li>
            <li class="flex items-center text-sm text-gray-700">
              <GeneralIcon icon="check" class="w-4 h-4 text-green-600 mr-2 flex-shrink-0" />
              Act on your behalf within NocoDB
            </li>
          </ul>
        </div>
      </div>

      <!-- User Info -->
      <div class="bg-blue-50 rounded-lg p-3 mb-6">
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-700"> <strong>Authorizing as:</strong> {{ user?.email }} </span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-3">
        <NcButton type="secondary" :disabled="authorizing" class="flex-1" @click="denyAuthorization"> Cancel </NcButton>
        <NcButton type="primary" :disabled="authorizing" :loading="authorizing" class="flex-1" @click="approveAuthorization">
          Authorize
        </NcButton>
      </div>

      <!-- Security Notice -->
      <p class="text-xs text-gray-500 text-center mt-4">
        Only authorize applications you trust. You can revoke access anytime from your account settings.
      </p>
    </div>
  </div>
</template>
