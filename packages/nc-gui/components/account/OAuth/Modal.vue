<script setup lang="ts">
import { type OAuthClientType, type OAuthTokenEndpointAuthMethod } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
}>()

const emits = defineEmits(['update:visible'])

const modalVisible = useVModel(props, 'visible', emits)

const { t } = useI18n()

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
  client_type: 'public' as OAuthClientType,
  client_description: '',
  client_uri: '',
  logo_uri: null,
  redirect_uris: '',
  allowed_grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none' as OAuthTokenEndpointAuthMethod,
})

const loading = ref(false)
const titleDomRef = ref<HTMLInputElement>()

// Validation rules
const validators = computed(() => ({
  client_name: [
    { required: true, message: t('msg.error.fieldRequired') },
    { min: 2, max: 50, message: 'Application name must be between 2 and 50 characters' },
  ],
  client_uri: [
    {
      validator: (_: any, value: string) => {
        if (value && !isValidURL(value)) {
          return Promise.reject(new Error('Please enter a valid URL'))
        }
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
            return Promise.reject(new Error(`Invalid URL: ${uri}`))
          }
        }

        return Promise.resolve()
      },
    },
  ],
}))

const { validate, validateInfos, clearValidate } = useForm(clientRef, validators)

// Reset form
function resetForm() {
  Object.assign(clientRef, {
    client_name: '',
    client_type: 'public' as OAuthClientType,
    client_uri: '',
    logo_uri: '',
    redirect_uris: '',
    allowed_grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
  })
  clearValidate()
}

// Handle form submission
async function handleSubmit() {
  try {
    await validate()
    loading.value = true

    // Parse redirect URIs
    const redirect_uris = clientRef.redirect_uris
      .split('\n')
      .map((uri) => uri.trim())
      .filter(Boolean)

    const payload = {
      ...clientRef,
      redirect_uris,
    }

    // Call API to create OAuth client
    // const response = await $api.oauth.clientCreate(payload)

    // Emit success event
    // emits('created', response)

    // Close modal and reset form
    modalVisible.value = false
    resetForm()

    // Show success message
    message.success('OAuth client created successfully!')
  } catch (error: any) {
    console.error('Failed to create OAuth client:', error)

    if (error.errorFields) {
      // Form validation errors - these will be displayed automatically
      return
    }

    // API errors
    const errorMsg = error.response?.data?.message || error.message || 'Failed to create OAuth client'
    message.error(errorMsg)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <NcModal v-model:visible="modalVisible" :show-separator="true" size="large" wrap-class-name="nc-modal-oauth-client-create-edit">
    <template #header>
      <div class="flex w-full items-center p-2 justify-between">
        <div class="flex items-center gap-3 pl-1 flex-1">
          <GeneralIcon class="text-gray-900 h-5 w-5" icon="ncLock" />
          <span class="text-gray-900 truncate font-semibold text-xl"> Create OAuth Client </span>
        </div>

        <div class="flex justify-end items-center gap-3 pr-0.5 flex-1">
          <NcButton type="primary" html-type="submit" size="small" :loading="loading">
            {{ loading ? 'Creating...' : 'Create OAuth Client' }}
          </NcButton>
          <NcButton type="text" size="small" data-testid="nc-close-oauth-modal" @click.stop="modalVisible = false">
            <GeneralIcon icon="close" />
          </NcButton>
        </div>
      </div>
    </template>

    <div class="flex bg-white rounded-b-2xl h-[calc(100%_-_66px)]">
      <div
        ref="containerElem"
        class="h-full flex-1 flex flex-col overflow-y-auto scroll-smooth nc-scrollbar-thin px-24 py-6 mx-auto"
      >
        <div class="flex flex-col max-w-[640px] w-full mx-auto gap-3">
          <a-form
            :model="clientRef"
            name="create-oauth-client"
            layout="vertical"
            class="flex flex-col gap-6"
            @finish="handleSubmit"
          >
            <a-form-item label="Application Name" v-bind="validateInfos.client_name" class="!mb-0 flex-1">
              <template #label>
                <span class="text-gray-700 font-medium">Application Name <span class="text-red-500">*</span></span>
              </template>
              <a-input
                ref="titleDomRef"
                v-model:value="clientRef.client_name"
                placeholder="Example App"
                class="nc-input-shadow !rounded-lg"
              />
            </a-form-item>

            <a-form-item label="Homepage URL" v-bind="validateInfos.client_uri" class="!mb-0 flex-1">
              <template #label>
                <span class="text-gray-700 font-medium">Homepage URL</span>
              </template>
              <a-input
                v-model:value="clientRef.client_uri"
                placeholder="https://example.com"
                class="nc-input-shadow !rounded-lg"
              />
            </a-form-item>

            <a-form-item label="Application Description" v-bind="validateInfos.client_description" class="!mb-0 flex-1">
              <template #label>
                <span class="text-gray-700 font-medium">Application Description</span>
              </template>
              <a-input
                ref="titleDomRef"
                v-model:value="clientRef.client_name"
                placeholder="Example App"
                class="nc-input-shadow !rounded-lg"
              />
            </a-form-item>

            <a-form-item label="Logo URL" class="items-start !mb-0" v-bind="validateInfos.logo_uri">
              <template #label>
                <span class="text-gray-700 font-medium">Logo URL</span>
              </template>
              <NcUpload v-model:attachment="clientRef.logo_uri" upload-path="clients/logos" :max-file-size="5">
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

            <!-- Redirect URIs -->
            <a-form-item label="Authorization Callback URLs" v-bind="validateInfos.redirect_uris" class="mb-0">
              <template #label>
                <span class="text-gray-700 font-medium">Authorization Callback URLs <span class="text-red-500">*</span></span>
              </template>
              <a-textarea
                v-model:value="clientRef.redirect_uris"
                :rows="4"
                placeholder="https://example.com/auth/callback&#10;https://localhost:3000/callback"
                class="nc-input-shadow !rounded-lg"
              />
            </a-form-item>
          </a-form>
        </div>
      </div>
      <div class="h-full bg-gray-50 border-l-1 w-80 p-5 rounded-br-2xl border-gray-200">
        <div class="w-full flex flex-col gap-3">
          <h2 class="text-sm text-gray-700 font-semibold !my-0">{{ $t('labels.supportDocs') }}</h2>
          <div>
            <div v-for="(doc, idx) of supportedDocs" :key="idx" class="flex items-center gap-1">
              <div class="h-7 w-7 flex items-center justify-center">
                <GeneralIcon icon="bookOpen" class="flex-none w-4 h-4 text-gray-500" />
              </div>
              <NuxtLink
                :href="doc.href"
                target="_blank"
                rel="noopener noreferrer"
                class="!text-gray-500 text-sm !no-underline !hover:underline"
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
