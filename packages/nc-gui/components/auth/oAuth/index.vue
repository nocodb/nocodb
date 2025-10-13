<script setup lang="ts">
const route = useRoute()

const { api } = useApi()
const { user } = useGlobal()

const { getPossibleAttachmentSrc } = useAttachment()

const clientId = computed(() => route.query.client_id as string)
const redirect_uri = computed(() => route.query.redirect_uri as string)
const responseType = computed(() => route.query.response_type as string)
const state = computed(() => route.query.state as string)
const codeChallenge = computed(() => route.query.code_challenge as string)
const resource = computed(() => route.query.resource as string)
const codeChallengeMethod = computed(() => route.query.code_challenge_method as string)

const loading = ref(true)
const error = ref('')
const authorizing = ref(false)
const clientInfo = ref<any>({})

const selectedWorkspace = ref()
const selectedBase = ref()

const isValidRequest = computed(() => {
  return clientId.value && redirect_uri.value && responseType.value === 'code'
})

const isSelectionValid = computed(() => {
  if (isEeUI) {
    return selectedWorkspace.value && selectedBase.value
  } else {
    return selectedBase.value
  }
})

const canAuthorize = computed(() => {
  return isValidRequest.value && isSelectionValid.value && !authorizing.value
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
  if (!canAuthorize.value) {
    return
  }

  authorizing.value = true

  try {
    const authParams: any = {
      client_id: clientId.value,
      redirect_uri: redirect_uri.value,
      state: state.value,
      approved: true,
      code_challenge: codeChallenge.value,
      code_challenge_method: codeChallengeMethod.value,
      base_id: selectedBase.value?.id,
      resource: resource.value,
    }

    if (isEeUI && selectedWorkspace.value?.id) {
      authParams.workspace_id = selectedWorkspace.value.id
    }

    const response = await api.oAuth.authorize(authParams)

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
  <div class="oauth-authorize-page bg-nc-bg-gray-extralight min-h-screen flex items-center justify-center p-4">
    <div v-if="loading" class="flex items-center bg-nc-bg-default flex-col gap-4">
      <GeneralLoader size="xlarge" />
      <p class="text-nc-content-gray-subtle2">Loading authorization request...</p>
    </div>

    <div
      v-else-if="error"
      class="rounded-xl shadow-sm bg-nc-bg-default border-1 border-nc-border-gray-medium p-8 max-w-md w-full text-center"
    >
      <GeneralIcon icon="alertTriangle" class="w-12 h-12 text-red-500 mx-auto mb-4" />
      <h2 class="text-xl font-semibold text-nc-content-gray-extreme mb-2">Authorization Error</h2>
      <p class="text-nc-content-gray-subtle2 mb-6">{{ error }}</p>
      <NcButton size="small" type="primary" @click="$router.push('/')"> Back to NocoDB </NcButton>
    </div>

    <div v-else class="rounded-xl bg-nc-bg-default shadow-sm border-1 border-nc-border-gray-medium p-8 max-w-lg w-full">
      <div class="flex items-center justify-center flex-1 w-full">
        <CellAttachmentPreviewImage
          v-if="clientInfo.logo_uri"
          :srcs="getPossibleAttachmentSrc(clientInfo.logo_uri)"
          class="!object-contain max-h-12 max-w-12 !rounded-full"
          :is-cell-preview="false"
        />
        <div v-else class="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-xl font-bold">
          {{ clientInfo.client_name?.charAt(0) || 'A' }}
        </div>
      </div>

      <h1 class="text-xl font-bold text-center mt-4 text-nc-content-gray-extreme">
        Authorize {{ clientInfo.client_name }} to access your account?
      </h1>

      <div class="text-nc-content-gray-muted text-center">
        <span class="font-semibold"> {{ clientInfo.client_name }} </span> needs access to your account to provide you service. We
        value your privacy and only request necessary permissions.
      </div>

      <div class="flex items-center justify-center my-6 gap-2">
        <GeneralUserIcon :user="user" size="medium" />
        {{ user.display_name || user.email }}
      </div>

      <NcDivider />

      <div class="my-6">
        <div class="flex gap-3 flex-col">
          <NcListWorkspaceSelector v-if="isEeUI" v-model:value="selectedWorkspace" force-layout="vertical" />

          <NcListBaseSelector v-model:value="selectedBase" force-layout="vertical" :workspace-id="selectedWorkspace" />
        </div>
      </div>

      <div class="bg-nc-bg-gray-extralight mt-4 rounded-lg p-4">
        <h3 class="font-medium text-gray-900 mb-3">This application will be able to:</h3>
        <ul class="space-y-2">
          <li class="flex items-center text-sm text-nc-content-gray-subtle">
            <GeneralIcon icon="ncCheck" class="w-4 h-4 text-green-600 mr-2 flex-shrink-0" />
            Access the selected base
          </li>
          <li class="flex items-center text-sm text-nc-content-gray-subtle">
            <GeneralIcon icon="ncCheck" class="w-4 h-4 text-green-600 mr-2 flex-shrink-0" />
            Read, create, update, and delete records in this base
          </li>
          <li class="flex items-center text-sm text-nc-content-gray-subtle">
            <GeneralIcon icon="ncCheck" class="w-4 h-4 text-green-600 mr-2 flex-shrink-0" />
            Act on your behalf within the selected resources
          </li>
        </ul>
      </div>

      <div class="flex gap-3 mt-4">
        <NcButton type="secondary" :disabled="authorizing" class="flex-1" @click="denyAuthorization"> Cancel </NcButton>
        <NcButton :disabled="!canAuthorize" :loading="authorizing" class="flex-1" @click="approveAuthorization">
          Authorize
        </NcButton>
      </div>

      <div v-if="!isSelectionValid && !loading" class="text-sm text-red-600 text-center mt-2">
        {{ isEeUI ? 'Please select both a workspace and base to continue.' : 'Please select a base to continue.' }}
      </div>
    </div>
  </div>
</template>
