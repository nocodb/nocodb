<script lang="ts" setup>
import type { WhiteLabelConfig } from 'nocodb-sdk'
import { PlanFeatureTypes } from 'nocodb-sdk'

const { config, isLoading, isSaving, load, save } = useWhiteLabel()

const { appInfo } = useGlobal()

const { t } = useI18n()

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

const isColorPickerOpen = ref(false)

// Curated seed presets that generate coherent ramps and read well with white
// button text. The free hex input remains for exact brand matching.
const brandPresetColors = ['#3366FF', '#1F3D99', '#0D5A5A', '#0FA14E', '#C86827', '#D50000', '#B33771', '#7D26CD']

function onPickBrandColor(color: string | null) {
  form.value.brandColor = color ? color.toUpperCase() : null
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
  message.toast(form.value.enabled ? t('labels.whiteLabel.savedAndApplied') : t('labels.whiteLabel.savedNotApplied'))
}

function onReset() {
  if (!initial.value) return
  form.value = { ...initial.value }
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

onBeforeRouteLeave(async (_to, _from, next) => {
  if (await promptUnsavedChanges()) next()
  else next(false)
})

// Admin tabs switch via an `activeTab` ref (not a route), so register the same
// prompt with the parent's tab guard. Cleared on unmount.
const { leaveGuard } = useAdminTabGuard()

leaveGuard.value = promptUnsavedChanges

onBeforeUnmount(() => {
  if (leaveGuard.value === promptUnsavedChanges) leaveGuard.value = null
})

onMounted(async () => {
  await load()
  syncFromConfig()
})

watch(config, syncFromConfig)
</script>

<template>
  <div class="flex flex-col h-full" data-testid="nc-admin-white-label">
    <div class="nc-breadcrumb px-2">
      <div class="nc-breadcrumb-item">{{ $t('labels.adminPanel') }}</div>
      <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />
      <div class="nc-breadcrumb-item active">{{ $t('labels.whiteLabel.title') }}</div>
    </div>

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
              <NcSwitch v-model:checked="form.enabled" size="default" />
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
                    accept="image/*"
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
                    accept="image/*"
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
                    accept="image/x-icon,image/png,image/svg+xml"
                    box-class="w-20 h-20"
                    compact
                  />
                  <div class="flex flex-col gap-1 pt-1">
                    <span class="text-nc-content-gray-subtle2">{{ $t('labels.whiteLabel.faviconDescription') }}</span>
                    <span class="text-nc-content-gray-muted text-bodySm">{{ $t('labels.whiteLabel.faviconFormatHint') }}</span>
                  </div>
                </div>
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
