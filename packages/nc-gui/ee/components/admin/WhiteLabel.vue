<script lang="ts" setup>
import type { WhiteLabelConfig } from 'nocodb-sdk'
import { PlanFeatureTypes } from 'nocodb-sdk'

const { config, isLoading, isSaving, load, save } = useWhiteLabel()

const { appInfo } = useGlobal()

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

// null when no/invalid colour → no indicator; true/false → good/low contrast.
const brandContrastOk = computed(() => isBrandColorReadable(form.value.brandColor ?? ''))

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
  if (payload.email && !payload.email.senderName && !payload.email.footerText && !payload.email.footerUrl) {
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
          <PaymentUpgradeBadge v-if="isOnPrem" :feature="PlanFeatureTypes.FEATURE_WHITE_LABEL" />
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
                  When enabled, the configured product name, logo, favicon, and brand color replace the NocoDB defaults across the
                  entire instance.
                </span>
              </div>
              <NcSwitch v-model:checked="form.enabled" size="default" />
            </div>
          </div>

          <!-- Branding fields -->
          <div class="flex flex-col border-1 rounded-2xl border-nc-border-gray-medium p-6 gap-4">
            <div class="font-bold text-base flex items-center gap-2" data-rec="true">
              <GeneralIcon icon="ncImage" class="h-4 w-4" />
              Branding
            </div>
            <span class="text-nc-content-gray-subtle2 mt-1">
              Upload images to replace the default branding. Each slot lists its own format and size.
            </span>

            <div class="flex flex-col gap-6">
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

              <!-- Logos -->
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <div class="text-nc-content-gray mb-2">Logo · light mode</div>
                  <AdminWhiteLabelAsset
                    v-model="form.logoUrl"
                    path-key="logoUrl"
                    accept="image/*"
                    preview-bg="light"
                    box-class="h-28 w-full"
                  />
                  <div class="text-nc-content-gray-muted text-bodySm mt-2">PNG / SVG · ~240×60 · max 2 MB</div>
                </div>
                <div>
                  <div class="text-nc-content-gray mb-2">Logo · dark mode</div>
                  <AdminWhiteLabelAsset
                    v-model="form.logoDarkUrl"
                    path-key="logoDarkUrl"
                    accept="image/*"
                    preview-bg="dark"
                    box-class="h-28 w-full"
                    empty-hint="Falls back to light logo when empty"
                  />
                  <div class="text-nc-content-gray-muted text-bodySm mt-2">PNG / SVG · ~240×60 · max 2 MB</div>
                </div>
              </div>

              <!-- Favicon -->
              <div>
                <div class="text-nc-content-gray mb-2">Favicon</div>
                <div class="flex items-start gap-4">
                  <AdminWhiteLabelAsset
                    v-model="form.faviconUrl"
                    path-key="faviconUrl"
                    accept="image/x-icon,image/png,image/svg+xml"
                    box-class="w-20 h-20"
                    compact
                  />
                  <div class="flex flex-col gap-1 pt-1">
                    <span class="text-nc-content-gray-subtle2">Square icon shown in browser tabs.</span>
                    <span class="text-nc-content-gray-muted text-bodySm">PNG / ICO · 48×48 · max 2 MB</span>
                  </div>
                </div>
              </div>

              <!-- Brand color -->
              <div>
                <div class="text-nc-content-gray mb-2">Brand color</div>
                <div class="flex items-center gap-3">
                  <a-input v-model:value="form.brandColor" class="!rounded-lg !px-4 h-10 w-60" placeholder="#0D5A5A" />
                  <div
                    class="w-10 h-10 rounded-lg border-1 border-nc-border-gray-medium flex-none"
                    :style="{ backgroundColor: form.brandColor || 'transparent' }"
                    aria-hidden="true"
                  />
                  <div v-if="brandContrastOk === true" class="flex items-center gap-1 text-nc-content-green-dark text-bodySm">
                    <GeneralIcon icon="ncCheck" class="h-4 w-4" />
                    Good contrast
                  </div>
                  <div
                    v-else-if="brandContrastOk === false"
                    class="flex items-center gap-1 text-nc-content-yellow-dark text-bodySm"
                  >
                    <GeneralIcon icon="ncAlertTriangle" class="h-4 w-4" />
                    White button text may be hard to read
                  </div>
                </div>
                <span class="text-nc-content-gray-muted text-bodySm"> Recolours buttons, links, and accents across the UI. </span>
              </div>
            </div>
          </div>

          <!-- Email branding -->
          <div class="flex flex-col border-1 rounded-2xl border-nc-border-gray-medium p-6 gap-4">
            <div class="font-bold text-base" data-rec="true">Email branding</div>
            <span class="text-nc-content-gray-subtle2 mt-1">
              These values override the default "NocoDB Team" footer in transactional emails (invites, password reset, etc.).
              Leave fields blank to keep the defaults.
            </span>

            <div class="flex flex-col gap-6">
              <div>
                <div class="text-nc-content-gray mb-2">Sender name</div>
                <a-input v-model:value="form.emailSenderName" class="!rounded-lg !px-4 h-10" placeholder="Acme" :maxlength="60" />
              </div>

              <div>
                <div class="text-nc-content-gray mb-2">Footer text</div>
                <a-textarea
                  v-model:value="form.emailFooterText"
                  class="nc-wl-footer-textarea"
                  :rows="2"
                  :maxlength="240"
                  placeholder="Acme — modern data management for your team."
                  show-count
                />
              </div>

              <div>
                <div class="text-nc-content-gray mb-2">Footer link URL</div>
                <a-input v-model:value="form.emailFooterUrl" class="!rounded-lg !px-4 h-10" placeholder="https://acme.com" />
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

// `show-count` wraps the textarea, so class-based rounding lands on the wrapper
// rather than the inner textarea that draws the border. Round + pad the inner
// element so it matches the sibling inputs.
.nc-wl-footer-textarea {
  :deep(textarea.ant-input) {
    @apply !rounded-lg !px-4 !py-2;
  }
}
</style>
