<script lang="ts" setup>
import type { WhiteLabelConfig } from 'nocodb-sdk'
import { PlanFeatureTypes, PublicAttachmentScope } from 'nocodb-sdk'

const { config, isLoading, isSaving, load, save } = useWhiteLabel()

const { appInfo } = useGlobal()

const { $api } = useNuxtApp()

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB

interface FormState {
  enabled: boolean
  productName: string | null
  logoUrl: string | null
  logoDarkUrl: string | null
  faviconUrl: string | null
  brandColor: string | null
  emailSenderName: string | null
  emailFooterText: string | null
  emailFooterUrl: string | null
}

const form = ref<FormState>({
  enabled: false,
  productName: null,
  logoUrl: null,
  logoDarkUrl: null,
  faviconUrl: null,
  brandColor: null,
  emailSenderName: null,
  emailFooterText: null,
  emailFooterUrl: null,
})

const initial = ref<FormState | null>(null)

const hasChanges = computed(() => {
  if (!initial.value) return true
  const keys = Object.keys(form.value) as (keyof FormState)[]
  return keys.some((k) => {
    const a = form.value[k]
    const b = initial.value![k]
    if (typeof a === 'boolean' || typeof b === 'boolean') return a !== b
    return (a ?? '') !== (b ?? '')
  })
})

const isOnPrem = computed(() => !!appInfo.value?.isOnPrem)

// In dev the frontend (:3000) and backend (:8080) are on different origins.
// A bare `/dltemp/...` URL would be resolved against the frontend origin and
// 404; explicitly join with `appInfo.ncSiteUrl` to point at the backend.
function joinSiteUrl(url: string | null): string {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  if (typeof window === 'undefined') return url
  const base = new URL(appInfo.value?.ncSiteUrl || '/', window.location.origin)
  return new URL(url, base).toString()
}

const logoPreviewSrc = computed(() => joinSiteUrl(form.value.logoUrl))
const logoDarkPreviewSrc = computed(() => joinSiteUrl(form.value.logoDarkUrl))
const faviconPreviewSrc = computed(() => joinSiteUrl(form.value.faviconUrl))

function syncFromConfig() {
  if (!config.value) return
  const c = config.value
  form.value = {
    enabled: !!c.enabled,
    productName: c.productName ?? null,
    logoUrl: c.logoUrl ?? null,
    logoDarkUrl: c.logoDarkUrl ?? null,
    faviconUrl: c.faviconUrl ?? null,
    brandColor: c.brandColor ?? null,
    emailSenderName: c.email?.senderName ?? null,
    emailFooterText: c.email?.footerText ?? null,
    emailFooterUrl: c.email?.footerUrl ?? null,
  }
  initial.value = { ...form.value }
}

function trim(value: string | null): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t === '' ? null : t
}

async function onSave() {
  const payload: Partial<WhiteLabelConfig> = {
    enabled: form.value.enabled,
    productName: trim(form.value.productName),
    logoUrl: trim(form.value.logoUrl),
    logoDarkUrl: trim(form.value.logoDarkUrl),
    faviconUrl: trim(form.value.faviconUrl),
    brandColor: trim(form.value.brandColor),
    email: {
      senderName: trim(form.value.emailSenderName),
      footerText: trim(form.value.emailFooterText),
      footerUrl: trim(form.value.emailFooterUrl),
    },
  }
  // Collapse the email object back to null when every field is blank — keeps
  // the persisted JSON tidy.
  if (
    payload.email &&
    !payload.email.senderName &&
    !payload.email.footerText &&
    !payload.email.footerUrl
  ) {
    payload.email = null
  }
  await save(payload)
  syncFromConfig()
  message.success('White-label settings updated')
}

function onReset() {
  if (!initial.value) return
  form.value = { ...initial.value }
}

const uploading = ref<{ [K in 'logoUrl' | 'logoDarkUrl' | 'faviconUrl']?: boolean }>({})

// Each uploader writes the resulting public URL into one of these form fields.
async function uploadAsset(
  file: File,
  target: 'logoUrl' | 'logoDarkUrl' | 'faviconUrl',
) {
  if (file.size > MAX_LOGO_SIZE_BYTES) {
    message.error('File must be 2 MB or smaller')
    return
  }

  uploading.value[target] = true
  try {
    const result = await $api.storage.upload(
      {
        path: ['noco', 'whiteLabel', target].join('/'),
        scope: PublicAttachmentScope.WHITELABEL,
      },
      { files: [file] as unknown as Blob[] },
    )
    const attachment = (result as any[])?.[0]
    if (!attachment) {
      message.error('Upload returned no file')
      return
    }
    // Use signedPath for the preview — it's a /dltemp/... URL that resolves
    // inline in the browser. The backend converts it back to the canonical
    // `download/whiteLabel/...` path on save (and re-signs on read).
    const raw = attachment.signedPath ?? attachment.url
    if (!raw) {
      message.error('Upload succeeded but no URL was returned')
      return
    }
    // Local storage returns `dltemp/...` without a leading slash, which the
    // browser would treat as a relative URL (from the current route). Force
    // it to be an absolute same-origin path.
    form.value[target] = /^(https?:\/\/|\/)/.test(raw) ? raw : `/${raw}`
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    uploading.value[target] = false
  }
}

function onFileSelected(
  e: Event,
  target: 'logoUrl' | 'logoDarkUrl' | 'faviconUrl',
) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void uploadAsset(file, target)
  // Reset so re-selecting the same file fires another change event.
  input.value = ''
}

function clearField(target: 'logoUrl' | 'logoDarkUrl' | 'faviconUrl') {
  form.value[target] = null
}

const fileInputLogo = ref<HTMLInputElement>()
const fileInputLogoDark = ref<HTMLInputElement>()
const fileInputFavicon = ref<HTMLInputElement>()

function pickFile(target: 'logoUrl' | 'logoDarkUrl' | 'faviconUrl') {
  const el =
    target === 'logoUrl'
      ? fileInputLogo.value
      : target === 'logoDarkUrl'
      ? fileInputLogoDark.value
      : fileInputFavicon.value
  el?.click()
}

onMounted(async () => {
  await load()
  syncFromConfig()
})

watch(config, syncFromConfig)
</script>

<template>
  <div class="flex flex-col" data-testid="nc-admin-white-label">
    <div class="nc-breadcrumb px-2">
      <div class="nc-breadcrumb-item">{{ $t('labels.adminPanel') }}</div>
      <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />
      <div class="nc-breadcrumb-item active">White Label</div>
    </div>

    <NcPageHeader>
      <template #icon>
        <GeneralIcon icon="ncImage" class="flex-none h-5 w-5" />
      </template>
      <template #title>
        <span data-rec="true" class="flex items-center gap-2">
          White Label
          <PaymentUpgradeBadge
            v-if="isOnPrem"
            :feature="PlanFeatureTypes.FEATURE_WHITE_LABEL"
          />
        </span>
      </template>
    </NcPageHeader>

    <div
      class="nc-content-max-w flex-1 max-h-[calc(100vh_-_100px)] overflow-y-auto nc-scrollbar-thin flex flex-col items-center gap-6 p-6"
    >
      <div class="flex flex-col gap-6 w-150">
        <GeneralLoader v-if="isLoading" size="large" class="mx-auto" />

        <template v-else>
          <!-- Master toggle -->
          <div class="flex flex-col border-1 rounded-2xl border-nc-border-gray-medium p-6 gap-4">
            <div class="flex items-center justify-between">
              <div>
                <div class="font-bold text-base" data-rec="true">Enable white-labeling</div>
                <span class="text-nc-content-gray-subtle2 mt-1 block">
                  When enabled, the configured product name, logo, favicon, and brand color
                  replace the NocoDB defaults across the entire instance.
                </span>
              </div>
              <NcSwitch v-model:checked="form.enabled" size="default" />
            </div>
          </div>

          <!-- Branding fields -->
          <div class="flex flex-col border-1 rounded-2xl border-nc-border-gray-medium p-6 gap-4">
            <div class="font-bold text-base" data-rec="true">Branding</div>
            <span class="text-nc-content-gray-subtle2 mt-1">
              Upload an image, or paste a hosted URL. Files up to 2 MB; PNG / SVG / ICO recommended.
            </span>

            <div class="flex flex-col gap-5">
              <div>
                <div class="text-nc-content-gray mb-2">Product name</div>
                <a-input
                  v-model:value="form.productName"
                  class="!rounded-lg !px-4 h-10"
                  placeholder="Acme Data"
                  :maxlength="60"
                  show-count
                />
              </div>

              <!-- Logo (light) -->
              <div>
                <div class="text-nc-content-gray mb-2">Logo (light mode)</div>
                <div class="flex items-start gap-3">
                  <div
                    class="w-24 h-16 rounded-lg border-1 border-nc-border-gray-medium flex-none flex items-center justify-center bg-white overflow-hidden"
                  >
                    <img
                      v-if="form.logoUrl"
                      :src="logoPreviewSrc"
                      alt="Logo preview"
                      class="max-w-full max-h-full object-contain"
                    />
                    <img
                      v-else
                      src="~/assets/img/brand/nocodb-full-color.png"
                      alt="Default NocoDB logo"
                      class="max-w-full max-h-full object-contain opacity-60"
                    />
                  </div>
                  <div class="flex-1 flex flex-col gap-2">
                    <div class="flex gap-2 items-center">
                      <NcButton
                        size="small"
                        type="secondary"
                        :loading="uploading.logoUrl"
                        @click="pickFile('logoUrl')"
                      >
                        {{ form.logoUrl ? 'Replace' : 'Upload' }}
                      </NcButton>
                      <input
                        ref="fileInputLogo"
                        type="file"
                        accept="image/*"
                        class="hidden"
                        @change="(e) => onFileSelected(e, 'logoUrl')"
                      />
                      <NcButton
                        v-if="form.logoUrl"
                        size="small"
                        type="text"
                        @click="clearField('logoUrl')"
                      >
                        {{ $t('general.remove') }}
                      </NcButton>
                    </div>
                    <a-input
                      v-model:value="form.logoUrl"
                      class="!rounded-lg !px-4 h-9 !text-bodySm"
                      placeholder="…or paste a URL"
                    />
                  </div>
                </div>
              </div>

              <!-- Logo (dark) -->
              <div>
                <div class="text-nc-content-gray mb-2">Logo (dark mode)</div>
                <div class="flex items-start gap-3">
                  <div
                    class="w-24 h-16 rounded-lg border-1 border-nc-border-gray-medium flex-none flex items-center justify-center bg-gray-800 overflow-hidden"
                  >
                    <img
                      v-if="form.logoDarkUrl"
                      :src="logoDarkPreviewSrc"
                      alt="Dark logo preview"
                      class="max-w-full max-h-full object-contain"
                    />
                    <img
                      v-else
                      src="~/assets/img/brand/full-logo.png"
                      alt="Default NocoDB dark logo"
                      class="max-w-full max-h-full object-contain opacity-60"
                    />
                  </div>
                  <div class="flex-1 flex flex-col gap-2">
                    <div class="flex gap-2 items-center">
                      <NcButton
                        size="small"
                        type="secondary"
                        :loading="uploading.logoDarkUrl"
                        @click="pickFile('logoDarkUrl')"
                      >
                        {{ form.logoDarkUrl ? 'Replace' : 'Upload' }}
                      </NcButton>
                      <input
                        ref="fileInputLogoDark"
                        type="file"
                        accept="image/*"
                        class="hidden"
                        @change="(e) => onFileSelected(e, 'logoDarkUrl')"
                      />
                      <NcButton
                        v-if="form.logoDarkUrl"
                        size="small"
                        type="text"
                        @click="clearField('logoDarkUrl')"
                      >
                        {{ $t('general.remove') }}
                      </NcButton>
                    </div>
                    <a-input
                      v-model:value="form.logoDarkUrl"
                      class="!rounded-lg !px-4 h-9 !text-bodySm"
                      placeholder="…or paste a URL (falls back to light logo when empty)"
                    />
                  </div>
                </div>
              </div>

              <!-- Favicon -->
              <div>
                <div class="text-nc-content-gray mb-2">Favicon</div>
                <div class="flex items-start gap-3">
                  <div
                    class="w-16 h-16 rounded-lg border-1 border-nc-border-gray-medium flex-none flex items-center justify-center bg-white overflow-hidden"
                  >
                    <img
                      v-if="form.faviconUrl"
                      :src="faviconPreviewSrc"
                      alt="Favicon preview"
                      class="max-w-full max-h-full object-contain"
                    />
                    <img
                      v-else
                      src="/favicon.ico"
                      alt="Default NocoDB favicon"
                      class="max-w-full max-h-full object-contain opacity-60"
                    />
                  </div>
                  <div class="flex-1 flex flex-col gap-2">
                    <div class="flex gap-2 items-center">
                      <NcButton
                        size="small"
                        type="secondary"
                        :loading="uploading.faviconUrl"
                        @click="pickFile('faviconUrl')"
                      >
                        {{ form.faviconUrl ? 'Replace' : 'Upload' }}
                      </NcButton>
                      <input
                        ref="fileInputFavicon"
                        type="file"
                        accept="image/x-icon,image/png,image/svg+xml"
                        class="hidden"
                        @change="(e) => onFileSelected(e, 'faviconUrl')"
                      />
                      <NcButton
                        v-if="form.faviconUrl"
                        size="small"
                        type="text"
                        @click="clearField('faviconUrl')"
                      >
                        {{ $t('general.remove') }}
                      </NcButton>
                    </div>
                    <a-input
                      v-model:value="form.faviconUrl"
                      class="!rounded-lg !px-4 h-9 !text-bodySm"
                      placeholder="…or paste a URL"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div class="text-nc-content-gray mb-2">Brand color (hex)</div>
                <div class="flex items-center gap-3">
                  <a-input
                    v-model:value="form.brandColor"
                    class="!rounded-lg !px-4 h-10 flex-1"
                    placeholder="#0D5A5A"
                  />
                  <div
                    class="w-10 h-10 rounded-lg border-1 border-nc-border-gray-medium flex-none"
                    :style="{ backgroundColor: form.brandColor || 'transparent' }"
                    aria-hidden="true"
                  />
                </div>
                <span class="text-nc-content-gray-muted text-bodySm">
                  Overrides <code>--color-brand-500</code> across the UI.
                </span>
              </div>
            </div>
          </div>

          <!-- Email branding -->
          <div class="flex flex-col border-1 rounded-2xl border-nc-border-gray-medium p-6 gap-4">
            <div class="font-bold text-base" data-rec="true">Email branding</div>
            <span class="text-nc-content-gray-subtle2 mt-1">
              These values override the default "NocoDB Team" footer in transactional emails
              (invites, password reset, etc.). Leave fields blank to keep the defaults.
            </span>

            <div class="flex flex-col gap-3">
              <div>
                <div class="text-nc-content-gray mb-2">Sender name</div>
                <a-input
                  v-model:value="form.emailSenderName"
                  class="!rounded-lg !px-4 h-10"
                  placeholder="Acme"
                  :maxlength="60"
                />
              </div>

              <div>
                <div class="text-nc-content-gray mb-2">Footer text</div>
                <a-textarea
                  v-model:value="form.emailFooterText"
                  class="!rounded-lg !px-4 py-2"
                  :rows="2"
                  :maxlength="240"
                  placeholder="Acme — modern data management for your team."
                  show-count
                />
              </div>

              <div>
                <div class="text-nc-content-gray mb-2">Footer link URL</div>
                <a-input
                  v-model:value="form.emailFooterUrl"
                  class="!rounded-lg !px-4 h-10"
                  placeholder="https://acme.com"
                />
                <span class="text-nc-content-gray-muted text-bodySm">
                  Must be an absolute http(s) URL — same-origin paths don't resolve from an inbox.
                </span>
              </div>
            </div>
          </div>

          <div class="flex flex-row w-full justify-end gap-4">
            <NcButton
              type="secondary"
              size="small"
              :disabled="!hasChanges || isSaving"
              data-testid="nc-white-label-reset"
              @click="onReset"
            >
              {{ $t('general.reset') }}
            </NcButton>
            <NcButton
              type="primary"
              size="small"
              :disabled="!hasChanges || isSaving"
              :loading="isSaving"
              data-testid="nc-white-label-save"
              @click="onSave"
            >
              <template #loading>{{ $t('general.saving') }}</template>
              {{ $t('general.save') }}
            </NcButton>
          </div>

          <div class="text-nc-content-gray-muted text-bodySm">
            Reload the page after saving to see the changes applied throughout the UI.
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
code {
  @apply bg-nc-bg-gray-light px-1 py-0.5 rounded text-bodySm;
}
</style>
