<script setup lang="ts">
import { WorkspaceUserRoles } from 'nocodb-sdk'
import type { BaseType, WorkspaceType } from 'nocodb-sdk'

const route = useRoute()

const { api } = useApi()
const { user } = useGlobal()

const { getPossibleAttachmentSrc } = useAttachment()

// Workspace and Base stores
const workspaceStore = useWorkspace()
const basesStore = useBases()

const { workspacesList, activeWorkspace } = storeToRefs(workspaceStore)
const { basesList } = storeToRefs(basesStore)

const clientId = computed(() => route.query.client_id as string)
const redirect_uri = computed(() => route.query.redirect_uri as string)
const responseType = computed(() => route.query.response_type as string)
const state = computed(() => route.query.state as string)
const codeChallenge = computed(() => route.query.code_challenge as string)
const codeChallengeMethod = computed(() => route.query.code_challenge_method as string)

const loading = ref(true)
const error = ref('')
const authorizing = ref(false)
const clientInfo = ref<any>({})

// Selection state
const selectedWorkspace = ref<WorkspaceType>()
const selectedBase = ref<BaseType>()
const isWorkspaceDropdownActive = ref(false)
const isBaseDropdownActive = ref(false)
const loadingWorkspaces = ref(false)
const loadingBases = ref(false)
const availableBases = ref<BaseType[]>([])

const isValidRequest = computed(() => {
  return clientId.value && redirect_uri.value && responseType.value === 'code'
})

const isSelectionValid = computed(() => {
  if (isEeUI) {
    // In EE, both workspace and base must be selected
    return selectedWorkspace.value && selectedBase.value
  } else {
    // In CE, only base needs to be selected (no workspaces)
    return selectedBase.value
  }
})

const canAuthorize = computed(() => {
  return isValidRequest.value && isSelectionValid.value && !authorizing.value
})

// Filter workspaces where user has appropriate permissions (EE only)
const filteredWorkspaces = computed(() => {
  if (!isEeUI) return []
  return (
    workspacesList.value?.filter(
      (ws) =>
        ws.roles === WorkspaceUserRoles.OWNER ||
        ws.roles === WorkspaceUserRoles.CREATOR ||
        ws.roles === WorkspaceUserRoles.EDITOR,
    ) || []
  )
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

    // Load workspaces and set default selection
    await loadWorkspacesAndBases()
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

async function loadWorkspacesAndBases() {
  try {
    if (isEeUI) {
      // EE: Load workspaces first, then bases for selected workspace
      loadingWorkspaces.value = true
      await workspaceStore.loadWorkspaces()

      // Set default workspace selection
      if (filteredWorkspaces.value.length > 0) {
        selectedWorkspace.value = activeWorkspace.value || filteredWorkspaces.value[0]
        await loadBasesForWorkspace(selectedWorkspace.value.id!)
      }
    } else {
      // CE: Load all bases directly (no workspaces)
      loadingBases.value = true
      const bases = await basesStore.loadProjects()
      availableBases.value = bases || []

      // Set default base selection
      if (availableBases.value.length > 0) {
        selectedBase.value = availableBases.value[0]
      }
    }
  } catch (err: any) {
    console.error('Failed to load data:', err)
    error.value = `Failed to load ${isEeUI ? 'workspaces' : 'bases'}`
  } finally {
    loadingWorkspaces.value = false
    loadingBases.value = false
  }
}

async function loadBasesForWorkspace(workspaceId: string) {
  try {
    loadingBases.value = true

    // Load bases for the selected workspace
    const bases = await basesStore.loadProjects('workspace', workspaceId)
    availableBases.value = bases || []

    // Set default base selection
    if (availableBases.value.length > 0) {
      selectedBase.value = availableBases.value[0]
    } else {
      selectedBase.value = undefined
    }
  } catch (err: any) {
    console.error('Failed to load bases:', err)
    availableBases.value = []
    selectedBase.value = undefined
  } finally {
    loadingBases.value = false
  }
}

const selectWorkspace = async (workspace: WorkspaceType) => {
  selectedWorkspace.value = workspace
  isWorkspaceDropdownActive.value = false

  // Load bases for the newly selected workspace
  await loadBasesForWorkspace(workspace.id!)
}

const selectBase = (base: BaseType) => {
  selectedBase.value = base
  isBaseDropdownActive.value = false
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
    }

    // Only include workspace_id in EE
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

        <!-- Resource Selection -->
        <div class="mb-6">
          <h3 class="font-medium text-gray-900 mb-3">Select resources to grant access to:</h3>

          <!-- Workspace Selection (EE only) -->
          <div v-if="isEeUI" class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">Workspace</label>
            <NcDropdown v-model:visible="isWorkspaceDropdownActive" class="w-full">
              <div
                class="rounded-lg border-1 transition-all cursor-pointer flex items-center border-nc-border-gray-medium h-10 py-2 gap-2 px-3 w-full"
                style="box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08)"
                :class="{
                  '!border-brand-500 !shadow-selected': isWorkspaceDropdownActive,
                }"
              >
                <GeneralWorkspaceIcon v-if="selectedWorkspace" size="small" :workspace="selectedWorkspace" />
                <div v-else class="w-6 h-6 rounded bg-gray-200 flex items-center justify-center">
                  <GeneralIcon icon="workspace" class="w-4 h-4 text-gray-500" />
                </div>

                <div class="flex-1 capitalize truncate text-sm">
                  {{ selectedWorkspace?.title || 'Select workspace...' }}
                </div>

                <GeneralIcon
                  :class="{
                    'transform rotate-180': isWorkspaceDropdownActive,
                  }"
                  class="text-nc-content-gray transition-all w-4 h-4"
                  icon="ncChevronDown"
                />
              </div>

              <template #overlay>
                <NcList
                  :value="selectedWorkspace"
                  :item-height="32"
                  close-on-select
                  :min-items-for-search="6"
                  container-class-name="w-full"
                  :list="filteredWorkspaces"
                  option-label-key="title"
                  class="nc-oauth-workspace-selection"
                >
                  <template #listItem="{ option }">
                    <div class="flex gap-2 w-full items-center" @click="selectWorkspace(option)">
                      <GeneralWorkspaceIcon :workspace="option" size="small" />

                      <div class="flex-1 text-sm truncate font-medium leading-5 capitalize w-full">
                        {{ option.title }}
                      </div>

                      <GeneralIcon v-if="option.id === selectedWorkspace?.id" class="text-brand-500 w-4 h-4" icon="ncCheck" />
                    </div>
                  </template>
                </NcList>
              </template>
            </NcDropdown>
          </div>

          <!-- Base Selection -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">Base</label>
            <NcDropdown
              v-model:visible="isBaseDropdownActive"
              class="w-full"
              :disabled="(isEeUI && !selectedWorkspace) || loadingBases"
            >
              <div
                class="rounded-lg border-1 transition-all cursor-pointer flex items-center border-nc-border-gray-medium h-10 py-2 gap-2 px-3 w-full"
                style="box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08)"
                :class="{
                  '!border-brand-500 !shadow-selected': isBaseDropdownActive,
                  'opacity-50 cursor-not-allowed': (isEeUI && !selectedWorkspace) || loadingBases,
                }"
              >
                <div class="w-6 h-6 rounded bg-blue-100 flex items-center justify-center">
                  <GeneralIcon v-if="loadingBases" icon="loading" class="w-4 h-4 text-blue-600 animate-spin" />
                  <GeneralIcon v-else icon="database" class="w-4 h-4 text-blue-600" />
                </div>

                <div class="flex-1 truncate text-sm">
                  {{
                    selectedBase?.title ||
                    (loadingBases ? 'Loading bases...' : availableBases.length > 0 ? 'Select base...' : 'No bases available')
                  }}
                </div>

                <GeneralIcon
                  :class="{
                    'transform rotate-180': isBaseDropdownActive,
                  }"
                  class="text-nc-content-gray transition-all w-4 h-4"
                  icon="ncChevronDown"
                />
              </div>

              <template #overlay>
                <NcList
                  v-if="availableBases.length > 0"
                  :value="selectedBase"
                  :item-height="32"
                  close-on-select
                  :min-items-for-search="6"
                  container-class-name="w-full"
                  :list="availableBases"
                  option-label-key="title"
                  class="nc-oauth-base-selection"
                >
                  <template #listItem="{ option }">
                    <div class="flex gap-2 w-full items-center" @click="selectBase(option)">
                      <div class="w-6 h-6 rounded bg-blue-100 flex items-center justify-center">
                        <GeneralIcon icon="database" class="w-4 h-4 text-blue-600" />
                      </div>

                      <div class="flex-1 text-sm truncate font-medium leading-5 w-full">
                        {{ option.title }}
                      </div>

                      <GeneralIcon v-if="option.id === selectedBase?.id" class="text-brand-500 w-4 h-4" icon="ncCheck" />
                    </div>
                  </template>
                </NcList>
                <div v-else class="p-3 text-sm text-gray-500 text-center">No bases available in this workspace</div>
              </template>
            </NcDropdown>
          </div>
        </div>

        <!-- Permissions -->
        <div class="bg-gray-50 rounded-lg p-4">
          <h3 class="font-medium text-gray-900 mb-3">This application will be able to:</h3>
          <ul class="space-y-2">
            <li v-if="isEeUI" class="flex items-center text-sm text-gray-700">
              <GeneralIcon icon="check" class="w-4 h-4 text-green-600 mr-2 flex-shrink-0" />
              Access the selected workspace: <strong class="ml-1">{{ selectedWorkspace?.title || 'None selected' }}</strong>
            </li>
            <li class="flex items-center text-sm text-gray-700">
              <GeneralIcon icon="check" class="w-4 h-4 text-green-600 mr-2 flex-shrink-0" />
              Access the selected base: <strong class="ml-1">{{ selectedBase?.title || 'None selected' }}</strong>
            </li>
            <li class="flex items-center text-sm text-gray-700">
              <GeneralIcon icon="check" class="w-4 h-4 text-green-600 mr-2 flex-shrink-0" />
              Read, create, update, and delete records in this base
            </li>
            <li class="flex items-center text-sm text-gray-700">
              <GeneralIcon icon="check" class="w-4 h-4 text-green-600 mr-2 flex-shrink-0" />
              Act on your behalf within the selected resources
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
        <NcButton type="primary" :disabled="!canAuthorize" :loading="authorizing" class="flex-1" @click="approveAuthorization">
          Authorize
        </NcButton>
      </div>

      <!-- Validation Message -->
      <div v-if="!isSelectionValid && !loading" class="text-sm text-red-600 text-center mt-2">
        {{ isEeUI ? 'Please select both a workspace and base to continue.' : 'Please select a base to continue.' }}
      </div>

      <!-- Security Notice -->
      <p class="text-xs text-gray-500 text-center mt-4">
        Only authorize applications you trust. You can revoke access anytime from your account settings.
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.oauth-authorize-page {
  .nc-oauth-workspace-selection,
  .nc-oauth-base-selection {
    .nc-list {
      @apply !w-full !pt-0;

      .nc-list-item {
        @apply !py-2;

        &:hover {
          @apply bg-gray-50;
        }
      }
    }
  }

  .shadow-selected {
    box-shadow: 0 0 0 2px rgb(59 130 246 / 0.15);
  }
}
</style>
