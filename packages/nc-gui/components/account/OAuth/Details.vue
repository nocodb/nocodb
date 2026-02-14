<script setup lang="ts">
import { OAuthClientType, PublicAttachmentScope } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
  clientId?: string
}>()

const emits = defineEmits(['update:visible', 'deleted'])

const modalVisible = useVModel(props, 'visible', emits)

const { t } = useI18n()

const oauthStore = useOAuthClients()

const { updateOAuthClient } = oauthStore

const { getPossibleAttachmentSrc } = useAttachment()

const { copy } = useCopy()

const useForm = Form.useForm

// Form data
const clientRef = ref({
  client_name: '',
  client_type: OAuthClientType.PUBLIC,
  client_description: '',
  client_uri: '',
  logo_uri: null,
  redirect_uris: '',
  client_id: '',
  client_secret: '',
  created_at: '',
})

const loading = ref(false)
const regenerateModalVisible = ref(false)
const showSecret = ref(false)
const secretJustRegenerated = ref(false)

// Validation rules
const validators = computed(() => ({
  client_name: [
    { required: true, message: t('msg.error.fieldRequired') },
    { min: 2, max: 255, message: 'Application name must be between 2 and 255 characters' },
  ],
  client_uri: [
    {
      validator: (_: any, _value: string) => {
        return Promise.resolve()
      },
    },
  ],
  redirect_uris: [
    { required: true, message: 'At least one redirect URI is required' },
    {
      validator: (_: any, value: string) => {
        if (!value) return Promise.resolve()

        const uris = value
          .split('\n')
          .map((uri) => uri.trim())
          .filter(Boolean)

        if (uris.length === 0) {
          return Promise.reject(new Error('At least one redirect URI is required'))
        }

        return Promise.resolve()
      },
    },
  ],
}))

const { validate, validateInfos } = useForm(clientRef, validators)

// Load client data
watch(
  () => props.clientId,
  async (newClientId) => {
    if (newClientId && modalVisible.value) {
      await loadClientData(newClientId)
    }
  },
  { immediate: true },
)

watch(modalVisible, async (newVal) => {
  if (newVal && props.clientId) {
    await loadClientData(props.clientId)
  } else if (!newVal) {
    showSecret.value = false
    secretJustRegenerated.value = false
  }
})

async function loadClientData(clientId: string) {
  try {
    loading.value = true
    const client = await oauthStore.loadOAuthClient(clientId)
    if (client) {
      clientRef.value = {
        client_name: client.client_name,
        client_type: client.client_type,
        client_description: client.client_description || '',
        client_uri: client.client_uri || '',
        logo_uri: client.logo_uri || null,
        redirect_uris: Array.isArray(client.redirect_uris) ? (client.redirect_uris || []).join('\n') : '',
        client_id: client.client_id,
        client_secret: client.client_secret || '',
        created_at: client.created_at || '',
      }
    }
  } catch (error) {
    console.error('Error loading client:', error)
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  try {
    await validate()
    loading.value = true

    const redirect_uris = clientRef.value.redirect_uris
      .split('\n')
      .map((uri) => uri.trim())
      .filter(Boolean)

    const payload = {
      client_name: clientRef.value.client_name,
      client_description: clientRef.value.client_description,
      client_uri: clientRef.value.client_uri,
      logo_uri: clientRef.value.logo_uri,
      redirect_uris,
    }

    await updateOAuthClient(props.clientId!, payload)
    message.success('OAuth client updated successfully!')
    modalVisible.value = false
  } catch (error: any) {
    if (error.errorFields) {
      return
    }
  } finally {
    loading.value = false
  }
}

function handleRegenerateSecret() {
  regenerateModalVisible.value = true
}

async function onRegeneratedSecret() {
  await loadClientData(props.clientId!)
  showSecret.value = true
  secretJustRegenerated.value = true
}

function copyToClipboard(text: string, label: string) {
  copy(text)
  message.success(`${label} copied to clipboard!`)
}
</script>

<template>
  <NcModal v-model:visible="modalVisible" :show-separator="true" size="large" wrap-class-name="nc-modal-oauth-client-details">
    <template #header>
      <div class="flex w-full items-center p-2 justify-between">
        <div class="flex items-center gap-3 pl-1 flex-1">
          <GeneralIcon class="text-nc-content-gray-emphasis h-5 w-5" icon="ncLock" />
          <span class="text-nc-content-gray-emphasis truncate font-semibold text-xl"> Edit OAuth Client </span>
        </div>

        <div class="flex justify-end items-center gap-3 pr-0.5 flex-1">
          <NcButton type="primary" size="small" :loading="loading" @click="handleSave">
            {{ loading ? 'Saving...' : 'Save Changes' }}
          </NcButton>
          <NcButton type="text" size="small" data-testid="nc-close-oauth-modal" @click.stop="modalVisible = false">
            <GeneralIcon icon="close" />
          </NcButton>
        </div>
      </div>
    </template>

    <div class="flex bg-nc-bg-default rounded-b-2xl h-[calc(100%_-_66px)]">
      <div
        ref="containerElem"
        class="h-full flex-1 flex flex-col overflow-y-auto scroll-smooth nc-scrollbar-thin px-24 py-6 mx-auto"
      >
        <div class="flex flex-col max-w-[640px] w-full mx-auto gap-3">
          <a-form :model="clientRef" name="edit-oauth-client" layout="vertical" class="flex flex-col gap-6">
            <!-- Application Name -->
            <a-form-item v-bind="validateInfos.client_name" class="!mb-0 flex-1">
              <template #label>
                <span class="text-nc-content-gray-subtle font-medium"
                  >Application Name <span class="text-nc-content-red-medium">*</span></span
                >
              </template>
              <template #extra>
                <span class="text-xs text-nc-content-gray-muted">Shown to users during authorization</span>
              </template>
              <a-input v-model:value="clientRef.client_name" placeholder="My Application" class="nc-input-shadow !rounded-lg" />
            </a-form-item>

            <!-- Application Description -->
            <a-form-item v-bind="validateInfos.client_description" class="!mb-0 flex-1">
              <template #label>
                <span class="text-nc-content-gray-subtle font-medium">Application Description</span>
              </template>
              <template #extra>
                <span class="text-xs text-nc-content-gray-muted">Brief description shown when users grant access</span>
              </template>
              <a-textarea
                v-model:value="clientRef.client_description"
                placeholder="This application helps you manage your data..."
                :rows="3"
                class="nc-input-shadow !rounded-lg"
              />
            </a-form-item>

            <!-- Homepage URL -->
            <a-form-item label="Homepage URL" v-bind="validateInfos.client_uri" class="!mb-0 flex-1">
              <template #label>
                <span class="text-nc-content-gray-subtle font-medium">Homepage URL</span>
              </template>
              <a-input
                v-model:value="clientRef.client_uri"
                placeholder="https://example.com"
                class="nc-input-shadow !rounded-lg"
              />
            </a-form-item>

            <!-- Logo -->
            <a-form-item label="Logo" class="items-start !mb-0">
              <template #label>
                <span class="text-nc-content-gray-subtle font-medium">Logo</span>
              </template>
              <template #extra>
                <span class="text-xs text-nc-content-gray-muted">Image shown during authorization (square recommended)</span>
              </template>
              <NcFileUpload
                v-model:attachment="clientRef.logo_uri"
                :upload-scope="PublicAttachmentScope.OAUTHCLIENTS"
                upload-path="clients/logos"
                :max-file-size="5"
              >
                <template #content>
                  <div v-if="clientRef.logo_uri" class="flex items-center space-x-3">
                    <CellAttachmentPreviewImage
                      :srcs="getPossibleAttachmentSrc(clientRef.logo_uri)"
                      class="flex-none !object-contain max-h-12 max-w-12 !rounded-lg !m-0"
                      :is-cell-preview="false"
                    />
                  </div>
                </template>
              </NcFileUpload>
            </a-form-item>

            <!-- Client Type (Read-only) -->
            <a-form-item class="!mb-0 flex-1">
              <template #label>
                <span class="text-nc-content-gray-subtle font-medium">Client Type</span>
              </template>
              <template #extra>
                <span class="text-xs text-nc-content-gray-muted">
                  Public: mobile/web apps (PKCE required). Confidential: secure servers (can store secrets)
                </span>
              </template>
              <a-radio-group v-model:value="clientRef.client_type" disabled class="nc-input-shadow">
                <a-radio value="public">Public</a-radio>
                <a-radio value="confidential">Confidential</a-radio>
              </a-radio-group>
            </a-form-item>

            <!-- Authorization Callback URLs -->
            <a-form-item label="Authorization Callback URLs" v-bind="validateInfos.redirect_uris" class="mb-0">
              <template #label>
                <span class="text-nc-content-gray-subtle font-medium"
                  >Authorization Callback URLs <span class="text-nc-content-red-medium">*</span></span
                >
              </template>
              <template #extra>
                <span class="text-xs text-nc-content-gray-muted">
                  HTTPS URLs for redirecting after authorization (localhost/127.0.0.1 allowed). One per line
                </span>
              </template>
              <a-textarea
                v-model:value="clientRef.redirect_uris"
                :rows="4"
                placeholder="https://example.com/auth/callback&#10;http://localhost:3000/callback&#10;http://127.0.0.1:3000/callback"
                class="nc-input-shadow !rounded-lg"
              />
            </a-form-item>
          </a-form>

          <a-divider class="!my-2" />

          <!-- Client ID (Read-only) -->
          <div class="flex flex-col gap-2">
            <label class="text-nc-content-gray-subtle font-medium text-sm">Client ID</label>
            <div class="flex items-center gap-2">
              <a-input :value="clientRef.client_id" readonly class="nc-input-shadow !rounded-lg flex-1" />
              <NcButton type="secondary" size="small" @click="copyToClipboard(clientRef.client_id, 'Client ID')">
                <GeneralIcon icon="copy" />
              </NcButton>
            </div>
          </div>

          <!-- Client Secret (Read-only, with show/hide) -->
          <div v-if="clientRef.client_type === 'confidential'" class="flex flex-col gap-2">
            <label class="text-nc-content-gray-subtle font-medium text-sm">Client Secret</label>
            <div v-if="clientRef.client_secret" class="flex items-center gap-2">
              <a-input
                :value="showSecret ? clientRef.client_secret : '••••••••••••••••••••••••••••••••'"
                readonly
                class="nc-input-shadow !rounded-lg flex-1"
              />
              <NcButton type="secondary" size="small" @click="showSecret = !showSecret">
                <GeneralIcon :icon="showSecret ? 'eye' : 'eyeSlash'" />
              </NcButton>
              <NcButton
                v-if="showSecret"
                type="secondary"
                size="small"
                @click="copyToClipboard(clientRef.client_secret, 'Client Secret')"
              >
                <GeneralIcon icon="copy" />
              </NcButton>
            </div>
            <div v-if="secretJustRegenerated" class="text-xs text-orange-600">
              ⚠️ Make sure to copy your client secret now. You won't be able to see it again!
            </div>
            <div v-else class="text-xs text-nc-content-gray-muted">
              The secret is hidden for security and is not visible again. You can regenerate it if needed.
            </div>
            <NcButton type="secondary" size="small" class="mt-2 w-fit" @click="handleRegenerateSecret">
              <div class="flex gap-2">
                <GeneralIcon icon="refresh" />
                Regenerate Secret
              </div>
            </NcButton>
          </div>
        </div>
      </div>
      <div class="h-full bg-nc-bg-gray-extralight border-l-1 w-80 p-5 rounded-br-2xl border-nc-border-gray-medium">
        <div class="w-full flex flex-col gap-3">
          <h2 class="text-sm text-nc-content-gray-subtle font-semibold !my-0">{{ $t('labels.supportDocs') }}</h2>
          <div>
            <div class="flex items-center gap-1">
              <div class="h-7 w-7 flex items-center justify-center">
                <GeneralIcon icon="bookOpen" class="flex-none w-4 h-4 text-nc-content-gray-muted" />
              </div>
              <NuxtLink
                href="https://nocodb.com/docs/product-docs/developer-resources/oauth-clients"
                target="_blank"
                rel="noopener noreferrer"
                class="!text-nc-content-gray-muted text-sm !no-underline !hover:underline"
              >
                Create OAuth Clients
              </NuxtLink>
            </div>
            <div class="flex items-center gap-1">
              <div class="h-7 w-7 flex items-center justify-center">
                <GeneralIcon icon="bookOpen" class="flex-none w-4 h-4 text-nc-content-gray-muted" />
              </div>
              <NuxtLink
                href="https://nocodb.com/docs/product-docs/developer-resources/oauth-clients/manage"
                target="_blank"
                rel="noopener noreferrer"
                class="!text-nc-content-gray-muted text-sm !no-underline !hover:underline"
              >
                Managing OAuth Clients
              </NuxtLink>
            </div>
          </div>
          <NcDivider />

          <div v-if="clientRef.client_id" class="flex flex-col gap-2">
            <h3 class="text-sm text-nc-content-gray-subtle font-semibold !my-0">Client Information</h3>
            <div class="text-xs text-nc-content-gray-muted space-y-1">
              <div>
                <span class="font-medium">Type:</span> {{ clientRef.client_type === 'public' ? 'Public' : 'Confidential' }}
              </div>
              <div><span class="font-medium">Created:</span> {{ new Date(clientRef.created_at).toLocaleDateString() }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </NcModal>

  <DlgOAuthClientRegenerateSecret
    v-if="clientRef.client_id"
    v-model="regenerateModalVisible"
    :oauth-client="clientRef as any"
    @regenerated="onRegeneratedSecret"
  />
</template>

<style lang="scss">
.nc-modal-oauth-client-details {
  z-index: 1050;
  .nc-modal {
    @apply !p-0;
    height: min(calc(100vh - 100px), 1024px);
    max-height: min(calc(100vh - 100px), 1024px) !important;
  }

  .nc-modal-header {
    @apply !mb-0 !pb-0;
  }
}
</style>
