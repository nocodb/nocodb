<script lang="ts" setup>
import type { WhiteLabelConfig } from 'nocodb-sdk'
import { PlanFeatureTypes, PublicAttachmentScope } from 'nocodb-sdk'

const { config, isLoading, isSaving, load, save } = useWhiteLabel()

const { appInfo } = useGlobal()

const { t } = useI18n()

const { $e } = useNuxtApp()

interface FormState {
  enabled: boolean
  productName: string | null
  logoUrl: string | null
  logoDarkUrl: string | null
  faviconUrl: string | null
  brandColor: string | null
  formBannerUrl: string | null
  supportEmail: string | null
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
  formBannerUrl: null,
  supportEmail: null,
  emailSenderName: null,
  emailFooterText: null,
  emailFooterUrl: null,
})

const initial = ref<FormState | null>(null)

// Form banner — separate file dialog + cropper (4:1 aspect ratio)
const showFormBannerCropper = ref(false)

const formBannerImageConfig = ref({ src: '', type: '', name: '' })

const { open: openFormBannerPicker, onChange: onFormBannerFileChange } = useFileDialog({
  accept: 'image/png,image/jpeg',
  multiple: false,
  reset: true,
})

const formBannerDropZone = ref<HTMLDivElement>()

function loadBannerFile(file: File) {
  // Drag-and-drop bypasses the file dialog's `accept`, so guard the type here.
  if (!['image/png', 'image/jpeg'].includes(file.type)) {
    message.error(t('labels.whiteLabel.unsupportedFileType'))
    return
  }
  if (formBannerImageConfig.value.src) URL.revokeObjectURL(formBannerImageConfig.value.src)
  formBannerImageConfig.value = { src: URL.createObjectURL(file), type: file.type, name: file.name }
  showFormBannerCropper.value = true
}

onFormBannerFileChange((files) => {
  const file = files?.[0]
  if (file) loadBannerFile(file)
})

const { isOverDropZone: isOverBannerDropZone } = useDropZone(formBannerDropZone, (files) => {
  const file = files?.[0]
  if (file) loadBannerFile(file)
})

function revokeBannerBlob() {
  if (formBannerImageConfig.value.src) {
    URL.revokeObjectURL(formBannerImageConfig.value.src)
    formBannerImageConfig.value = { src: '', type: '', name: '' }
  }
}

// The object URL is only needed while the cropper is open (it reads
// `imageConfig.src`; the upload uses the cropped canvas, not the blob). Revoke
// it whenever the cropper closes — saved or cancelled — to avoid a memory leak.
watch(showFormBannerCropper, (open) => {
  if (!open) revokeBannerBlob()
})

function onFormBannerUploaded(attachment: any) {
  const raw = attachment?.signedPath ?? attachment?.path ?? attachment?.url
  if (!raw) return
  form.value.formBannerUrl = /^(https?:\/\/|\/)/.test(raw) ? raw : `/${raw}`
  $e('c:white-label:banner:upload')
}

function removeFormBanner() {
  form.value.formBannerUrl = null
  $e('c:white-label:banner:remove')
}

// In dev the frontend (:3000) and backend (:8080) differ; a bare `/dltemp/...`
// would resolve against the frontend origin and 404. Join with ncSiteUrl so the
// preview loads (mirrors AdminWhiteLabelAsset). Absolute URLs pass through.
const formBannerPreviewSrc = computed(() => {
  const url = form.value.formBannerUrl
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  if (typeof window === 'undefined') return url
  const base = new URL(appInfo.value?.ncSiteUrl || '/', window.location.origin)
  return new URL(url, base).toString()
})

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

const isColorPickerOpen = ref(false)

// Curated seed presets that generate coherent ramps and read well with white
// button text. The free hex input remains for exact brand matching.
const brandPresetColors = ['#3366FF', '#1F3D99', '#0D5A5A', '#0FA14E', '#C86827', '#D50000', '#B33771', '#7D26CD']

// The colour picker emits an 8-digit hex (#RRGGBBAA); the brand colour is solid
// and the backend only accepts #RGB / #RRGGBB, so drop the alpha channel.
function normalizeBrandColor(color: string | null | undefined): string | null {
  if (!color) return null
  const c = color.trim()
  const hex8 = c.match(/^#?([0-9a-fA-F]{6})[0-9a-fA-F]{2}$/)
  return (hex8 ? `#${hex8[1]}` : c).toUpperCase()
}

function onPickBrandColor(color: string | null) {
  form.value.brandColor = normalizeBrandColor(color)
  $e('c:white-label:brand-color')
}

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
    formBannerUrl: c.formBannerUrl ?? null,
    supportEmail: c.supportEmail ?? null,
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
  $e('a:white-label:save')

  const payload: Partial<WhiteLabelConfig> = {
    enabled: form.value.enabled,
    productName: trim(form.value.productName),
    logoUrl: trim(form.value.logoUrl),
    logoDarkUrl: trim(form.value.logoDarkUrl),
    faviconUrl: trim(form.value.faviconUrl),
    brandColor: normalizeBrandColor(form.value.brandColor),
    formBannerUrl: trim(form.value.formBannerUrl),
    supportEmail: trim(form.value.supportEmail),
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
  message.toast(form.value.enabled ? t('labels.whiteLabel.savedAndApplied') : t('labels.whiteLabel.savedNotApplied'))
}

function onReset() {
  $e('c:white-label:reset')
  if (!initial.value) return
  form.value = { ...initial.value }
  // Drop any in-flight cropper selection (and its blob) the user hadn't saved.
  showFormBannerCropper.value = false
  revokeBannerBlob()
}

// Warn before losing edits on browser refresh / tab close.
function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!hasChanges.value) return
  e.preventDefault()
  // Required for the native prompt to show in some browsers.
  e.returnValue = ''
}

useEventListener(typeof window !== 'undefined' ? window : null, 'beforeunload', onBeforeUnload)

// Prompt about unsaved edits. Resolves true to proceed (leave), false to stay.
// Shared by the route guard (real navigation) and the admin tab-switch guard.
function promptUnsavedChanges(): Promise<boolean> {
  if (!hasChanges.value) return Promise.resolve(true)

  return new Promise<boolean>((resolve) => {
    const isOpen = ref(true)
    const okProps = ref({ loading: false })
    let settled = false

    const { close } = useDialog(resolveComponent('NcModalConfirm'), {
      'visible': isOpen,
      'title': t('msg.info.unsavedChanges'),
      'content': t('activity.doYouWantToSaveTheChanges'),
      'okText': t('tooltip.saveChanges'),
      'cancelText': t('labels.discard'),
      'okProps': okProps,
      'showIcon': false,
      'keyboard': false,
      'maskClosable': false,
      'onCancel': () => finish(true), // Discard → leave
      'onOk': async () => {
        okProps.value.loading = true
        try {
          await onSave()
          finish(true)
        } catch {
          // Save failed — error already surfaced; stay.
          okProps.value.loading = false
          finish(false)
        }
      },
      // Programmatic close (finish) sets isOpen=false too; `settled` guards
      // against a double-resolve.
      'onUpdate:visible': (v: boolean) => {
        if (!v) finish(true)
      },
    })

    function finish(proceed: boolean) {
      if (settled) return
      settled = true
      isOpen.value = false
      close(300)
      resolve(proceed)
    }
  })
}

onBeforeRouteLeave(async (to, _from, next) => {
  // A forced logout / session-expiry redirects to an auth page (e.g. /signin)
  // via navigateTo, so this guard fires. Don't prompt there: the user can't
  // save once logged out, and blocking the redirect would strand them on the
  // admin page. Auth pages opt out of auth via `requiresAuth: false`.
  if (to.meta.requiresAuth === false) return next()
  if (await promptUnsavedChanges()) next()
  else next(false)
})

// Admin tabs switch via an `activeTab` ref (not a route), so register the same
// prompt with the parent's tab guard. Cleared on unmount.
const { leaveGuard } = useAdminTabGuard()

leaveGuard.value = promptUnsavedChanges

onBeforeUnmount(() => {
  if (leaveGuard.value === promptUnsavedChanges) leaveGuard.value = null
  // Revoke a leftover blob if the component is torn down with the cropper open.
  revokeBannerBlob()
})

onMounted(async () => {
  await load()
  syncFromConfig()
})

watch(config, syncFromConfig)
</script>

<template>
  <div class="flex flex-col h-full" data-testid="nc-admin-white-label">
    <NcPageHeader>
      <template #icon>
        <GeneralIcon icon="ncImage" class="flex-none h-5 w-5" />
      </template>
      <template #title>
        <span data-rec="true" class="flex items-center gap-2">
          {{ $t('labels.whiteLabel.title') }}
          <PaymentUpgradeBadge v-if="isOnPrem" :feature="PlanFeatureTypes.FEATURE_WHITE_LABEL" />
        </span>
      </template>
    </NcPageHeader>

    <div class="nc-content-max-w flex-1 min-h-0 overflow-y-auto nc-scrollbar-thin flex flex-col items-center gap-6 p-6">
      <div class="flex flex-col gap-6 w-150">
        <GeneralLoader v-if="isLoading" size="large" class="mx-auto" />

        <template v-else>
          <!-- Master toggle -->
          <div class="flex flex-col border-1 rounded-2xl border-nc-border-gray-medium p-6 gap-4">
            <div class="flex items-center justify-between">
              <div>
                <div class="font-bold text-base" data-rec="true">{{ $t('labels.whiteLabel.enable') }}</div>
                <span class="text-nc-content-gray-subtle2 mt-1 block">
                  {{ $t('labels.whiteLabel.enableDescription') }}
                </span>
              </div>
              <NcSwitch v-model:checked="form.enabled" v-e="['c:white-label:enable:toggle']" size="default" />
            </div>
          </div>

          <!-- Branding fields -->
          <div
            class="flex flex-col border-1 rounded-2xl border-nc-border-gray-medium p-6 gap-4 transition-opacity"
            :class="{ 'opacity-60': !form.enabled }"
          >
            <div class="font-bold text-base flex items-center gap-2" data-rec="true">
              <GeneralIcon icon="ncImage" class="h-4 w-4" />
              {{ $t('labels.whiteLabel.branding') }}
            </div>
            <span class="text-nc-content-gray-subtle2 mt-1">
              {{ $t('labels.whiteLabel.brandingDescription') }}
            </span>

            <div class="flex flex-col gap-6">
              <div>
                <div class="text-nc-content-gray mb-2">{{ $t('labels.whiteLabel.productName') }}</div>
                <a-input
                  v-model:value="form.productName"
                  class="!rounded-lg !px-4 h-10"
                  :placeholder="$t('labels.whiteLabel.placeholder.productName')"
                  :maxlength="60"
                  show-count
                />
              </div>

              <!-- Logos -->
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <div class="text-nc-content-gray mb-2">{{ $t('labels.whiteLabel.logoLight') }}</div>
                  <AdminWhiteLabelAsset
                    v-model="form.logoUrl"
                    path-key="logoUrl"
                    accept="image/png"
                    preview-bg="light"
                    box-class="h-28 w-full"
                  />
                  <div class="text-nc-content-gray-muted text-bodySm mt-2">{{ $t('labels.whiteLabel.logoFormatHint') }}</div>
                </div>
                <div>
                  <div class="text-nc-content-gray mb-2">{{ $t('labels.whiteLabel.logoDark') }}</div>
                  <AdminWhiteLabelAsset
                    v-model="form.logoDarkUrl"
                    path-key="logoDarkUrl"
                    accept="image/png"
                    preview-bg="dark"
                    box-class="h-28 w-full"
                    :empty-hint="$t('labels.whiteLabel.logoDarkFallback')"
                  />
                  <div class="text-nc-content-gray-muted text-bodySm mt-2">{{ $t('labels.whiteLabel.logoFormatHint') }}</div>
                </div>
              </div>

              <!-- Favicon -->
              <div>
                <div class="text-nc-content-gray mb-2">{{ $t('labels.whiteLabel.favicon') }}</div>
                <div class="flex items-start gap-4">
                  <AdminWhiteLabelAsset
                    v-model="form.faviconUrl"
                    path-key="faviconUrl"
                    accept="image/png,image/x-icon"
                    box-class="w-20 h-20"
                    compact
                  />
                  <div class="flex flex-col gap-1 pt-1">
                    <span class="text-nc-content-gray-subtle2">{{ $t('labels.whiteLabel.faviconDescription') }}</span>
                    <span class="text-nc-content-gray-muted text-bodySm">{{ $t('labels.whiteLabel.faviconFormatHint') }}</span>
                  </div>
                </div>
              </div>

              <!-- Default form banner -->
              <div>
                <div class="text-nc-content-gray mb-2">{{ $t('labels.whiteLabel.formBanner') }}</div>

                <!-- Preview when uploaded -->
                <div
                  v-if="form.formBannerUrl"
                  class="group relative rounded-lg border-1 border-nc-border-gray-medium overflow-hidden h-28 w-full flex items-center justify-center bg-nc-bg-gray-light"
                >
                  <img :src="formBannerPreviewSrc" alt="" class="w-full h-full object-cover" />
                  <div
                    class="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                  >
                    <NcTooltip :title="$t('general.replace')">
                      <button
                        type="button"
                        class="flex items-center justify-center h-8 w-8 rounded-lg bg-white/90 text-nc-content-gray hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        @click="openFormBannerPicker()"
                      >
                        <GeneralIcon icon="ncEdit" class="h-4 w-4" />
                      </button>
                    </NcTooltip>
                    <NcTooltip :title="$t('general.remove')">
                      <button
                        type="button"
                        class="flex items-center justify-center h-8 w-8 rounded-lg bg-white/90 text-nc-content-red-medium hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        @click="removeFormBanner"
                      >
                        <GeneralIcon icon="ncTrash2" class="h-4 w-4" />
                      </button>
                    </NcTooltip>
                  </div>
                </div>

                <!-- Empty: dropzone (click or drag & drop) -->
                <div
                  v-else
                  ref="formBannerDropZone"
                  class="rounded-lg border-1 border-dashed border-nc-border-gray-medium h-28 w-full flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors hover:border-nc-border-brand hover:bg-nc-bg-gray-light"
                  :class="{ '!border-nc-border-brand bg-nc-bg-brand': isOverBannerDropZone }"
                  @click="openFormBannerPicker()"
                >
                  <GeneralIcon icon="ncUpload" class="h-6 w-6 text-nc-content-gray-muted" />
                  <span class="text-nc-content-gray-subtle2">
                    {{ $t('labels.whiteLabel.dragDropPrefix') }}
                    <span class="text-nc-content-brand font-medium">{{ $t('labels.whiteLabel.browse') }}</span>
                  </span>
                </div>

                <div class="text-nc-content-gray-muted text-bodySm mt-2">{{ $t('labels.whiteLabel.formBannerDescription') }}</div>
                <div class="text-nc-content-gray-muted text-bodySm mt-1">{{ $t('labels.whiteLabel.formBannerFormatHint') }}</div>

                <GeneralImageCropper
                  v-model:show-cropper="showFormBannerCropper"
                  :image-config="formBannerImageConfig"
                  :cropper-config="{ stencilProps: { aspectRatio: 4 / 1 }, imageRestriction: 'none' }"
                  :upload-config="{ path: 'noco/whiteLabel/formBannerUrl', scope: PublicAttachmentScope.WHITELABEL }"
                  @submit="onFormBannerUploaded"
                />
              </div>

              <!-- Brand color -->
              <div>
                <div class="text-nc-content-gray mb-2">{{ $t('labels.whiteLabel.brandColor') }}</div>
                <div class="flex items-center gap-3">
                  <a-input
                    v-model:value="form.brandColor"
                    class="!rounded-lg !px-4 h-10 w-60"
                    :placeholder="$t('labels.whiteLabel.placeholder.brandColor')"
                  />
                  <a-dropdown v-model:visible="isColorPickerOpen" :trigger="['click']" overlay-class-name="nc-wl-color-picker">
                    <NcTooltip :title="$t('labels.whiteLabel.pickColor')">
                      <div
                        class="w-10 h-10 rounded-lg border-1 border-nc-border-gray-medium flex-none cursor-pointer transition-shadow hover:shadow-sm"
                        :class="{ 'ring-2 ring-nc-border-brand': isColorPickerOpen }"
                        :style="{ backgroundColor: form.brandColor || 'transparent' }"
                      />
                    </NcTooltip>
                    <template #overlay>
                      <GeneralColorPicker
                        :model-value="form.brandColor || undefined"
                        :colors="brandPresetColors"
                        is-new-design
                        @input="onPickBrandColor"
                      />
                    </template>
                  </a-dropdown>
                </div>

                <div
                  v-if="brandContrastOk === true"
                  class="flex items-center gap-1.5 mt-2 text-nc-content-green-dark text-bodySm"
                >
                  <GeneralIcon icon="ncCheck" class="flex-none h-4 w-4" />
                  {{ $t('labels.whiteLabel.goodContrast') }}
                </div>
                <div
                  v-else-if="brandContrastOk === false"
                  class="flex items-center gap-1.5 mt-2 text-nc-content-yellow-dark text-bodySm"
                >
                  <GeneralIcon icon="ncAlertTriangle" class="flex-none h-4 w-4" />
                  {{ $t('labels.whiteLabel.lowContrast') }}
                </div>

                <span class="text-nc-content-gray-muted text-bodySm mt-1 block">
                  {{ $t('labels.whiteLabel.brandColorHint') }}
                </span>
              </div>
            </div>
          </div>

          <!-- Email branding -->
          <div
            class="flex flex-col border-1 rounded-2xl border-nc-border-gray-medium p-6 gap-4 transition-opacity"
            :class="{ 'opacity-60': !form.enabled }"
          >
            <div class="font-bold text-base" data-rec="true">{{ $t('labels.whiteLabel.emailBranding') }}</div>
            <span class="text-nc-content-gray-subtle2 mt-1">
              {{ $t('labels.whiteLabel.emailBrandingDescription') }}
            </span>

            <div class="flex flex-col gap-6">
              <div>
                <div class="text-nc-content-gray mb-2">{{ $t('labels.whiteLabel.senderName') }}</div>
                <a-input
                  v-model:value="form.emailSenderName"
                  class="!rounded-lg !px-4 h-10"
                  :placeholder="$t('labels.whiteLabel.placeholder.senderName')"
                  :maxlength="60"
                />
              </div>

              <div>
                <div class="text-nc-content-gray mb-2">{{ $t('labels.whiteLabel.footerText') }}</div>
                <a-textarea
                  v-model:value="form.emailFooterText"
                  class="nc-wl-footer-textarea"
                  :rows="2"
                  :maxlength="240"
                  :placeholder="$t('labels.whiteLabel.placeholder.footerText')"
                  show-count
                />
              </div>

              <div>
                <div class="text-nc-content-gray mb-2">{{ $t('labels.whiteLabel.footerUrl') }}</div>
                <a-input
                  v-model:value="form.emailFooterUrl"
                  class="!rounded-lg !px-4 h-10"
                  :placeholder="$t('labels.whiteLabel.placeholder.footerUrl')"
                />
                <span class="text-nc-content-gray-muted text-bodySm">
                  {{ $t('labels.whiteLabel.footerUrlHint') }}
                </span>
              </div>
            </div>
          </div>

          <!-- Support -->
          <div
            class="flex flex-col border-1 rounded-2xl border-nc-border-gray-medium p-6 gap-4 transition-opacity"
            :class="{ 'opacity-60': !form.enabled }"
          >
            <div class="font-bold text-base" data-rec="true">{{ $t('labels.whiteLabel.helpSupport') }}</div>
            <span class="text-nc-content-gray-subtle2 mt-1">
              {{ $t('labels.whiteLabel.helpSupportDescription') }}
            </span>

            <div>
              <div class="text-nc-content-gray mb-2">{{ $t('labels.whiteLabel.supportEmail') }}</div>
              <a-input
                v-model:value="form.supportEmail"
                class="!rounded-lg !px-4 h-10"
                :placeholder="$t('labels.whiteLabel.placeholder.supportEmail')"
                :maxlength="254"
              />
              <span class="text-nc-content-gray-muted text-bodySm">
                {{ $t('labels.whiteLabel.supportEmailHint') }}
              </span>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Sticky action footer — always visible, sits below the scroll area -->
    <div v-if="!isLoading" class="shrink-0 border-t border-nc-border-gray-medium bg-nc-bg-default flex justify-center px-6 py-3">
      <div class="w-150 flex flex-row items-center gap-4">
        <div v-if="!form.enabled" class="flex items-center gap-2 min-w-0 text-nc-content-yellow-dark font-medium">
          <GeneralIcon icon="ncAlertTriangle" class="flex-none h-4 w-4" />
          <span class="truncate">{{ $t('labels.whiteLabel.disabledNotice') }}</span>
        </div>
        <NcButton
          type="secondary"
          size="small"
          class="ml-auto"
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

<style lang="scss">
// The color-picker dropdown is teleported to <body>, so it needs a non-scoped
// rule. The picker root (.color-picker) already has a background + padding but
// no border/radius/shadow, so it blends into the page — add the card chrome.
.nc-wl-color-picker .color-picker {
  @apply border-1 border-nc-border-gray-medium rounded-xl shadow-lg;
}
</style>
