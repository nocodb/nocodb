<script setup lang="ts">
import { OAuthClientType, PublicAttachmentScope } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
}>()

const emits = defineEmits(['update:visible'])

const modalVisible = useVModel(props, 'visible', emits)

const { t } = useI18n()

const oauthStore = useOAuthClients()

const { createOAuthClient } = oauthStore

const { getPossibleAttachmentSrc } = useAttachment()

const supportedDocs = [
  {
    title: 'NocoDB OAuth Client Setup',
    href: 'https://docs.nocodb.com/nc-gui/oauth-client-setup',
  },
  {
    title: 'NocoDB OAuth Client Setup',
    href: 'https://docs.nocodb.com/nc-gui/oauth-client-setup',
  },
]

const useForm = Form.useForm

// Form data
const clientRef = reactive({
  client_name: '',
  client_type: OAuthClientType.PUBLIC,
  client_description: '',
  client_uri: '',
  logo_uri: null,
  redirect_uris: '',
  allowed_grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
})

const loading = ref(false)
const titleDomRef = ref<HTMLInputElement>()
const createdClient = ref<any>(null)
const showSuccessView = ref(false)

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
  logo_uri: [
    {
      validator: (_: any, value: string) => {
        if (!value) {
          return Promise.reject(new Error('Please select a valid File'))
        }
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

        for (const uri of uris) {
          if (!isValidURL(uri)) {
            // return Promise.reject(new Error(`Invalid URL: ${uri}`))
          }
        }

        return Promise.resolve()
      },
    },
  ],
}))

const { validate, validateInfos, clearValidate } = useForm(clientRef, validators)

function resetForm() {
  Object.assign(clientRef, {
    client_name: '',
    client_type: 'public' as OAuthClientType,
    client_description: '',
    client_uri: '',
    logo_uri: '',
    redirect_uris: '',
    allowed_grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
  })
  clearValidate()
  showSuccessView.value = false
  createdClient.value = null
}

async function handleSubmit() {
  try {
    await validate()
    loading.value = true

    const redirect_uris = clientRef.redirect_uris
      .split('\n')
      .map((uri) => uri.trim())
      .filter(Boolean)

    const payload = {
      ...clientRef,
      redirect_uris,
    }

    createdClient.value = await createOAuthClient(payload)
    showSuccessView.value = true

    // Show success message
    message.success('OAuth client created successfully!')
  } catch (error: any) {
    if (error.errorFields) {
      // Form validation errors - these will be displayed automatically
      return
    }
  } finally {
    loading.value = false
  }
}

function handleClose() {
  modalVisible.value = false
  resetForm()
}

const { copy } = useCopy()

function copyToClipboard(text: string, label: string) {
  copy(text)
  message.success(`${label} copied to clipboard!`)
}
</script>

<template>
  <NcModal v-model:visible="modalVisible" :show-separator="true" size="large" wrap-class-name="nc-modal-oauth-client-create-edit">
    <template #header>
      <div class="flex w-full items-center p-2 justify-between">
        <div class="flex items-center gap-3 pl-1 flex-1">
          <GeneralIcon class="text-nc-content-gray-emphasis h-5 w-5" icon="ncLock" />
          <span class="text-nc-content-gray-emphasis truncate font-semibold text-xl"> Create OAuth Client </span>
        </div>

        <div class="flex justify-end items-center gap-3 pr-0.5 flex-1">
          <NcButton
            v-if="!showSuccessView"
            type="primary"
            html-type="submit"
            size="small"
            :loading="loading"
            @click="handleSubmit"
          >
            {{ loading ? 'Creating...' : 'Create OAuth Client' }}
          </NcButton>
          <NcButton v-if="showSuccessView" type="primary" size="small" @click="handleClose"> Done </NcButton>
          <NcButton type="text" size="small" data-testid="nc-close-oauth-modal" @click.stop="handleClose">
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
        <!-- Success View -->
        <div v-if="showSuccessView" class="flex flex-col max-w-[640px] w-full mx-auto gap-6">
          <NcAlert type="info">
            <template #message> OAuth Client Created Successfully! </template>
            <template #description>
              Make sure to copy your client credentials now. You won't be able to see the secret again.
            </template>
          </NcAlert>

          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-2">
              <label class="text-nc-content-gray-subtle font-medium text-sm">Client ID</label>
              <div class="flex items-center gap-2">
                <a-input :value="createdClient?.client_id" readonly class="nc-input-shadow !rounded-lg flex-1" />
                <NcButton type="secondary" size="small" @click="copyToClipboard(createdClient?.client_id, 'Client ID')">
                  <GeneralIcon icon="copy" />
                </NcButton>
              </div>
            </div>

            <div v-if="createdClient?.client_secret" class="flex flex-col gap-2">
              <label class="text-nc-content-gray-subtle font-medium text-sm">Client Secret</label>
              <div class="flex items-center gap-2">
                <a-input :value="createdClient?.client_secret" readonly class="nc-input-shadow !rounded-lg flex-1" />
                <NcButton type="secondary" size="small" @click="copyToClipboard(createdClient?.client_secret, 'Client Secret')">
                  <GeneralIcon icon="copy" />
                </NcButton>
              </div>
            </div>
          </div>
        </div>

        <!-- Create Form -->
        <div v-else class="flex flex-col max-w-[640px] w-full mx-auto gap-3">
          <a-form :model="clientRef" name="create-oauth-client" layout="vertical" class="flex flex-col gap-6">
            <a-form-item v-bind="validateInfos.client_name" class="!mb-0 flex-1">
              <template #label>
                <span class="text-nc-content-gray-subtle font-medium">Application Name <span class="text-red-500">*</span></span>
              </template>
              <template #extra>
                <span class="text-xs text-nc-content-gray-muted">Shown to users during authorization</span>
              </template>
              <a-input
                ref="titleDomRef"
                v-model:value="clientRef.client_name"
                placeholder="My Application"
                class="nc-input-shadow !rounded-lg"
              />
            </a-form-item>

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

            <a-form-item class="items-start !mb-0" v-bind="validateInfos.logo_uri">
              <template #label>
                <span class="text-nc-content-gray-subtle font-medium">Logo</span>
              </template>
              <template #extra>
                <span class="text-xs text-nc-content-gray-muted">Image shown during authorization (square recommended)</span>
              </template>
              <NcUpload
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
              </NcUpload>
            </a-form-item>

            <!-- Client Type -->
            <a-form-item class="!mb-0 flex-1">
              <template #label>
                <span class="text-nc-content-gray-subtle font-medium">Client Type</span>
              </template>
              <template #extra>
                <span class="text-xs text-nc-content-gray-muted">
                  Public: mobile/web apps (PKCE required). Confidential: secure servers (can store secrets)
                </span>
              </template>
              <a-radio-group v-model:value="clientRef.client_type" class="nc-input-shadow">
                <a-radio value="public">Public</a-radio>
                <a-radio value="confidential">Confidential</a-radio>
              </a-radio-group>
            </a-form-item>

            <!-- Redirect URIs -->
            <a-form-item v-bind="validateInfos.redirect_uris" class="mb-0">
              <template #label>
                <span class="text-nc-content-gray-subtle font-medium"
                  >Authorization Callback URLs <span class="text-red-500">*</span></span
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
        </div>
      </div>
      <div class="h-full bg-nc-bg-gray-extralight border-l-1 w-80 p-5 rounded-br-2xl border-nc-border-gray-medium">
        <div class="w-full flex flex-col gap-3">
          <h2 class="text-sm text-nc-content-gray-subtle font-semibold !my-0">{{ $t('labels.supportDocs') }}</h2>
          <div>
            <div v-for="(doc, idx) of supportedDocs" :key="idx" class="flex items-center gap-1">
              <div class="h-7 w-7 flex items-center justify-center">
                <GeneralIcon icon="bookOpen" class="flex-none w-4 h-4 text-nc-content-gray-muted" />
              </div>
              <NuxtLink
                :href="doc.href"
                target="_blank"
                rel="noopener noreferrer"
                class="!text-nc-content-gray-muted text-sm !no-underline !hover:underline"
              >
                {{ doc.title }}
              </NuxtLink>
            </div>
          </div>
          <NcDivider />
        </div>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-oauth-client-create-edit {
  z-index: 1050;
  a {
    @apply !no-underline !text-gray-700 !hover:text-primary;
  }
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
