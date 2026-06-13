<script setup lang="ts">
import { PlanFeatureTypes } from 'nocodb-sdk'

const { api } = useApi()

const { t } = useI18n()

const { $e } = useNuxtApp()

const { blockMfa, showUpgradeToUseMfa, isEEFeatureBlocked } = useEeConfig()

const { appInfo, signOut } = useGlobal()

const { copy } = useCopy()

const route = useRoute()

const router = useRouter()

const mfaEnabled = ref(false)
const hasPassword = ref(true)
const isLoading = ref(false)

// MFA-enrolment gating — set by /mfa/status. Three ineligible cases:
//   - 'sso'             — current session is SAML / OIDC. Block enrolment;
//                         2FA should be configured at the IdP.
//   - 'federated'       — Cognito-federated (Google) with no email/password
//                         on the same account. Same reasoning.
//   - 'legacy_session'  — Cloud session minted before per-session
//                         identity stamping landed. Prompt the user to
//                         sign out + back in to refresh the tag.
const mfaEligible = ref(true)
const ineligibleReason = ref<'sso' | 'federated' | 'legacy_session' | null>(null)
// Provider name (e.g. 'Google') surfaced by `/mfa/status` for the
// federated case so the tooltip can name the IdP the user is signed in
// with. Falls back to the generic "identity provider" copy when absent.
const federationProvider = ref<string | null>(null)

// Setup wizard state
const showSetupModal = ref(false)
const setupData = ref<{ secret: string; qrUrl: string; backupCodes: string[] } | null>(null)
const setupCode = ref('')
const setupError = ref('')
const setupPassword = ref('')
const setupStep = ref<'password' | 'qr' | 'verify' | 'backup'>('password')
const setupCodeInput = ref<HTMLInputElement>()
const setupPasswordInput = ref<HTMLInputElement>()

// Disable state
const showDisableModal = ref(false)
const disablePassword = ref('')
const disableError = ref('')
const disablePasswordInput = ref<HTMLInputElement>()

// Backup codes state
const showRegenerateModal = ref(false)
const regenerateCode = ref('')
const regenerateError = ref('')
const newBackupCodes = ref<string[]>([])
const regenerateCodeInput = ref<HTMLInputElement>()

async function fetchStatus() {
  if (isEEFeatureBlocked.value) return

  try {
    const response = await api.instance.get('/api/v2/auth/mfa/status')
    mfaEnabled.value = response.data.enabled
    hasPassword.value = response.data.hasPassword ?? true
    // Older backends won't echo `eligible` — default to true so the
    // existing CE / on-prem behaviour is preserved.
    mfaEligible.value = response.data.eligible ?? true
    ineligibleReason.value = response.data.ineligibleReason ?? null
    federationProvider.value = response.data.federationProvider ?? null
  } catch {
    // ignore
  }
}

// Eligibility for the enrollment flow:
//   - Account has a local password → classic password-confirm flow.
//   - On Cloud, Cognito-native (signed up via email/password to the
//     User Pool) → backend re-verifies the supplied password against
//     Cognito's InitiateAuth, so we DO render the password step here.
//   - On Cloud, Cognito-federated (Google etc.) → backend rejects with
//     403; FE marks `mfaEligible=false` so the toggle is disabled and
//     the tooltip points the user at their IdP.
// `mfaEligible` is the single switch; the explicit ineligible reason
// today is only `federated`.
const canSetup2fa = computed(() => mfaEligible.value && (hasPassword.value || appInfo.value?.isCloud))

// Note: this component intentionally does NOT branch the reproof flow
// based on identity source. After mfa.service.setup was tightened to
// reject every reachable path that doesn't carry a password (Cognito
// native InitiateAuth, local bcrypt, or 403), the FE-side matrix
// became redundant — every `canSetup2fa` user goes through the
// password step, and the BE picks bcrypt vs InitiateAuth from
// `req.user.extra` + `user.password`. Keeping the FE oblivious to
// the matrix means we only have to evolve one side when the rules
// change.

// Tooltip copy for ineligible-toggle users. Each variant names the
// auth method the user is currently signed in with, then gives one
// uniform directive: sign in with email and password to set up 2FA.
const ineligibleTooltip = computed(() => {
  if (mfaEligible.value) return ''
  if (ineligibleReason.value === 'federated') {
    return federationProvider.value
      ? t('labels.twoFactorFederatedNotAvailable', { provider: federationProvider.value })
      : t('labels.twoFactorFederatedNotAvailableGeneric')
  }
  if (ineligibleReason.value === 'sso') return t('labels.twoFactorSsoSessionNotAvailable')
  if (ineligibleReason.value === 'legacy_session') return t('labels.twoFactorLegacySession')
  return t('labels.twoFactorSsoNotAvailable')
})

function startSetup() {
  if (blockMfa.value) {
    showUpgradeToUseMfa({ triggerSource: 'account-security-mfa' })
    return
  }

  if (!canSetup2fa.value) return

  $e('c:account:security:enable-2fa')
  setupPassword.value = ''
  setupError.value = ''
  showSetupModal.value = true
  setupStep.value = 'password'
  nextTick(() => setupPasswordInput.value?.focus())
}

async function confirmPassword() {
  if (!setupPassword.value) return

  isLoading.value = true
  setupError.value = ''

  try {
    const response = await api.instance.post('/api/v2/auth/mfa/setup', {
      password: setupPassword.value,
    })
    setupData.value = response.data
    setupStep.value = 'qr'
  } catch (e: any) {
    setupError.value = await extractSdkResponseErrorMsg(e)
  } finally {
    isLoading.value = false
  }
}

async function confirmSetup() {
  if (!setupCode.value) return

  isLoading.value = true
  setupError.value = ''

  try {
    await api.instance.post('/api/v2/auth/mfa/verify-setup', {
      code: setupCode.value,
    })
    setupStep.value = 'backup'
    mfaEnabled.value = true
    $e('a:account:security:2fa-enabled')
    message.success(t('msg.success.twoFactorEnabled'))
  } catch (e: any) {
    setupError.value = await extractSdkResponseErrorMsg(e)
  } finally {
    isLoading.value = false
  }
}

async function closeSetupModal() {
  // If the user is closing the modal after seeing the backup codes,
  // enrolment has succeeded — the BE rotated `token_version` to
  // invalidate every existing session (mfa.service.verifySetup). The
  // current FE still holds the now-stale token, and without an API
  // call to surface the 401 the user can sit on /account forever
  // until they navigate or refresh. Force the sign-out → /signin
  // round trip so they immediately re-authenticate under the new
  // 2FA-protected flow.
  const justEnrolled = setupStep.value === 'backup'

  showSetupModal.value = false
  setupData.value = null
  setupCode.value = ''
  setupPassword.value = ''
  setupError.value = ''
  setupStep.value = 'password'
  isLoading.value = false

  if (justEnrolled) {
    await signOut({ redirectToSignin: true })
  }
}

async function confirmDisable() {
  // Always send the password — BE picks bcrypt vs Cognito InitiateAuth
  // from the session context. Federated / SSO sessions get rejected by
  // the BE with 403 before this codepath even renders (the Disable
  // button is hidden for ineligible users); but we keep the password
  // requirement here so the BE/FE stay consistent if eligibility ever
  // expands.
  if (!disablePassword.value) return

  isLoading.value = true
  disableError.value = ''

  try {
    await api.instance.post('/api/v2/auth/mfa/disable', {
      password: disablePassword.value,
    })
    // Disable does NOT rotate token_version BE-side (other sessions
    // were already authenticated under the stricter 2FA gate, so
    // weakening doesn't justify killing them). User stays signed in
    // on the current device — the Security card updates in place.
    mfaEnabled.value = false
    showDisableModal.value = false
    disablePassword.value = ''
    $e('a:account:security:2fa-disabled')
    message.success(t('msg.success.twoFactorDisabled'))
  } catch (e: any) {
    disableError.value = await extractSdkResponseErrorMsg(e)
  } finally {
    isLoading.value = false
  }
}

async function confirmRegenerate() {
  if (!regenerateCode.value) return

  isLoading.value = true
  regenerateError.value = ''

  try {
    const response = await api.instance.post('/api/v2/auth/mfa/regenerate-backup-codes', {
      code: regenerateCode.value,
    })
    newBackupCodes.value = response.data.backupCodes
    regenerateCode.value = ''
    $e('a:account:security:backup-codes-regenerated')
    message.success(t('msg.success.backupCodesRegenerated'))
  } catch (e: any) {
    regenerateError.value = await extractSdkResponseErrorMsg(e)
  } finally {
    isLoading.value = false
  }
}

function closeRegenerateModal() {
  showRegenerateModal.value = false
  regenerateCode.value = ''
  regenerateError.value = ''
  newBackupCodes.value = []
  isLoading.value = false
}

const recentlyCopied = ref(false)
let copiedTimeout: ReturnType<typeof setTimeout>

function showCopiedFeedback() {
  recentlyCopied.value = true
  clearTimeout(copiedTimeout)
  copiedTimeout = setTimeout(() => {
    recentlyCopied.value = false
  }, 2000)
}

function copyBackupCodes(codes: string[]) {
  copy(codes.join('\n'))
  showCopiedFeedback()
}

function copySecret() {
  if (setupData.value?.secret) {
    copy(setupData.value.secret)
    showCopiedFeedback()
  }
}

function goToVerifyStep() {
  setupStep.value = 'verify'
  nextTick(() => setupCodeInput.value?.focus())
}

watch(showRegenerateModal, (v) => {
  if (v) {
    regenerateCode.value = ''
    regenerateError.value = ''
    newBackupCodes.value = []
    nextTick(() => regenerateCodeInput.value?.focus())
  }
})

watch(showDisableModal, (v) => {
  if (v) {
    disablePassword.value = ''
    disableError.value = ''
    nextTick(() => disablePasswordInput.value?.focus())
  }
})

onMounted(async () => {
  await fetchStatus()

  // Auto-open the enrollment modal when arriving here from the
  // workspace's force_2fa redirect (DlgWorkspaceMfaSetupRequired sets
  // `?openEnrollment=true` on the navigation). Strip the param after
  // we've consumed it so a page refresh doesn't re-trigger the modal.
  if (route.query.openEnrollment === 'true' && !mfaEnabled.value) {
    startSetup()
    const { openEnrollment: _, ...rest } = route.query
    router.replace({ path: route.path, query: rest })
  }
})
</script>

<template>
  <div class="flex flex-col">
    <NcPageHeader>
      <template #icon>
        <GeneralIcon class="flex-none !h-5 !w-5" icon="ncShield" />
      </template>
      <template #title>
        {{ $t('labels.security') }}
      </template>
    </NcPageHeader>
    <div class="h-[calc(100vh_-_100px)] overflow-auto nc-scrollbar-thin">
      <div class="h-full nc-content-max-w p-6">
        <div class="flex flex-col w-150 mx-auto">
          <!-- 2FA Section -->
          <div class="nc-settings-item-card-wrapper mt-5">
            <div class="nc-settings-item-heading text-nc-content-gray-emphasis">
              {{ $t('labels.twoFactorAuth') }}
            </div>

            <div class="nc-settings-item-card p-6">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="flex flex-col gap-1.5 min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <div class="text-sm font-semibold text-nc-content-gray">{{ $t('labels.twoFactorAuth') }}</div>
                    <!--
                      Show "Enabled" only when the user is BOTH enrolled
                      *and* eligible to manage MFA from this session.
                      An SSO / federated session on a user who once enrolled
                      via email/password would otherwise see a green
                      "Enabled" badge that lies — those sessions don't get
                      the OTP challenge (IdP owns auth), so the stored TOTP
                      is dead state. Render as "Disabled" with the tooltip
                      explaining the email/password sign-in path.
                    -->
                    <NcBadge
                      v-if="mfaEnabled && mfaEligible"
                      :border="false"
                      class="!bg-green-100 !text-green-600 !border-green-200 flex items-center gap-1"
                    >
                      <GeneralIcon icon="circleCheck" class="h-4 w-4" />
                      {{ $t('general.enabled') }}
                    </NcBadge>
                    <div
                      v-else
                      class="text-nc-content-gray-muted text-xs font-medium bg-nc-bg-gray-light px-2 py-0.5 rounded-full"
                    >
                      {{ $t('general.disabled') }}
                    </div>
                    <PaymentUpgradeBadge :feature="PlanFeatureTypes.FEATURE_MFA" />
                  </div>
                  <div class="text-bodyDefaultSm text-nc-content-gray-subtle">
                    {{ $t('labels.twoFactorAuthDescription') }}
                  </div>
                </div>

                <div class="flex-shrink-0">
                  <!--
                    Show the Disable button only when the user is BOTH
                    enrolled and eligible to manage MFA from this session.
                    For an enrolled-but-ineligible session (SSO / federated
                    on a user who once enrolled via email/password), surface
                    the disabled Enable button + tooltip — they need to
                    sign in via email/password to manage anything here.
                  -->
                  <NcTooltip v-if="!mfaEnabled || !mfaEligible" :disabled="canSetup2fa" :title="ineligibleTooltip">
                    <NcButton
                      v-e="['c:account:security:enable-2fa']"
                      :type="blockMfa ? 'secondary' : 'primary'"
                      size="small"
                      :loading="isLoading"
                      :disabled="!canSetup2fa"
                      data-testid="nc-2fa-enable-btn"
                      @click="startSetup"
                    >
                      {{ $t('labels.enableTwoFactor') }}
                    </NcButton>
                  </NcTooltip>
                  <NcButton
                    v-else
                    v-e="['c:account:security:disable-2fa']"
                    type="secondary"
                    size="small"
                    class="!text-nc-content-red-dark"
                    data-testid="nc-2fa-disable-btn"
                    @click="showDisableModal = true"
                  >
                    {{ $t('labels.disableTwoFactor') }}
                  </NcButton>
                </div>
              </div>

              <!--
                Backup-code regen is only meaningful for enrolled users
                who can actually manage their 2FA from this session.
                For ineligible-but-enrolled (SSO / federated session over
                an account that once had email/password), hide the whole
                regen section — they need to switch sign-in method first.
              -->
              <template v-if="mfaEnabled && mfaEligible">
                <NcDivider class="!my-4" />
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div class="flex flex-col gap-1 min-w-0 flex-1">
                    <div class="text-sm font-medium text-nc-content-gray">{{ $t('labels.backupCodes') }}</div>
                    <div class="text-bodyDefaultSm text-nc-content-gray-subtle">
                      {{ $t('labels.backupCodesDescription') }}
                    </div>
                  </div>
                  <NcButton
                    v-e="['c:account:security:regenerate-backup-codes']"
                    type="secondary"
                    size="small"
                    class="flex-shrink-0"
                    data-testid="nc-2fa-regenerate-btn"
                    @click="showRegenerateModal = true"
                  >
                    {{ $t('labels.regenerateBackupCodes') }}
                  </NcButton>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Setup Modal -->
    <NcModalConfirm
      v-model:visible="showSetupModal"
      :title="$t('labels.setupTwoFactor')"
      :show-icon="false"
      :mask-closable="setupStep !== 'verify' && setupStep !== 'backup'"
      :show-ok-btn="false"
      :show-cancel-btn="false"
      @cancel="closeSetupModal"
    >
      <template #headerAction>
        <NcButton
          v-if="setupStep !== 'verify' && setupStep !== 'backup'"
          size="small"
          type="text"
          class="-mt-1.5 -mr-1.5"
          @click="closeSetupModal"
        >
          <GeneralIcon icon="close" class="text-nc-content-gray-subtle2" />
        </NcButton>
      </template>
      <template #content>
        <span v-if="setupStep === 'password'">{{ $t('labels.confirmPasswordToSetup') }}</span>
        <span v-else-if="setupStep === 'qr'">{{ $t('labels.scanQrCodeDescription') }}</span>
        <span v-else-if="setupStep === 'verify'">{{ $t('labels.enterCodeFromApp') }}</span>
        <span v-else-if="setupStep === 'backup'">{{ $t('labels.saveBackupCodes') }}</span>
      </template>
      <template #extraContent>
        <!-- Step 0: Password confirmation -->
        <div v-if="setupStep === 'password'" class="flex flex-col gap-5">
          <div class="flex flex-col gap-2">
            <span class="text-sm">{{ $t('labels.password') }}</span>
            <a-input-password
              ref="setupPasswordInput"
              v-model:value="setupPassword"
              data-testid="nc-2fa-setup-password"
              class="w-full nc-input-sm nc-input-shadow"
              :placeholder="$t('msg.info.signUp.enterPassword')"
              @press-enter="confirmPassword"
            />
            <div v-if="setupError" class="text-red-500 text-sm">{{ setupError }}</div>
          </div>
          <div class="flex flex-row gap-x-2 justify-end">
            <NcButton type="secondary" size="small" @click="closeSetupModal">
              {{ $t('general.cancel') }}
            </NcButton>
            <NcButton type="primary" size="small" :loading="isLoading" :disabled="!setupPassword" @click="confirmPassword">
              {{ $t('general.next') }}
            </NcButton>
          </div>
        </div>

        <!-- Step 1: QR Code -->
        <div v-else-if="setupStep === 'qr' && setupData" class="flex flex-col gap-5">
          <!--
            Scope reminder on Cloud — Cognito users may have a parallel
            Google (or other federated) identity on the same email. 2FA
            we set up here applies to their email/password sign-in only;
            federated sign-ins are managed by the provider and won't be
            challenged for this code. Surfacing the constraint up-front
            so dual-identity users don't think the federated bypass is a
            bug after enrolment.
          -->
          <div
            v-if="appInfo?.isCloud"
            class="rounded-md border border-nc-border-gray-medium bg-nc-bg-gray-extralight px-3 py-2 text-xs text-nc-content-gray-subtle"
          >
            {{ $t('labels.twoFactorScopeBanner') }}
          </div>
          <div class="flex flex-col items-center gap-3">
            <img :src="setupData.qrUrl" :alt="$t('title.qrCode')" class="w-60 h-60" />
            <div class="bg-nc-bg-gray-light rounded-lg px-3 py-2 flex items-center justify-center gap-2">
              <code class="text-xs break-all text-nc-content-gray select-all">{{ setupData.secret }}</code>
              <NcTooltip :visible="recentlyCopied ? true : undefined">
                <template #title>{{ recentlyCopied ? $t('general.copied') : $t('general.copy') }}</template>
                <NcButton type="text" size="xs" class="flex-shrink-0" data-testid="nc-2fa-copy-secret-btn" @click="copySecret">
                  <GeneralIcon :icon="recentlyCopied ? 'check' : 'copy'" class="h-3.5 w-3.5" />
                </NcButton>
              </NcTooltip>
            </div>
            <span class="text-xs text-nc-content-gray-muted text-center">{{ $t('labels.manualEntryHint') }}</span>
          </div>
          <div class="flex flex-row gap-x-2 justify-end">
            <NcButton type="primary" size="small" data-testid="nc-2fa-setup-qr-next-btn" @click="goToVerifyStep">
              {{ $t('general.next') }}
            </NcButton>
          </div>
        </div>

        <!-- Step 2: Verify -->
        <div v-else-if="setupStep === 'verify'" class="flex flex-col gap-5">
          <div class="flex flex-col gap-2">
            <span class="text-sm">{{ $t('labels.verificationCode') }}</span>
            <a-input
              ref="setupCodeInput"
              v-model:value="setupCode"
              data-testid="nc-2fa-setup-code"
              class="w-full nc-input-sm nc-input-shadow"
              :placeholder="$t('placeholder.enterVerificationCode')"
              autocomplete="one-time-code"
              @press-enter="confirmSetup"
            />
          </div>
          <div v-if="setupError" class="text-red-500 text-sm">{{ setupError }}</div>
          <div class="flex flex-row gap-x-2 justify-end">
            <NcButton
              type="primary"
              size="small"
              :loading="isLoading"
              :disabled="!setupCode"
              data-testid="nc-2fa-setup-verify-btn"
              @click="confirmSetup"
            >
              {{ $t('general.verify') }}
            </NcButton>
          </div>
        </div>

        <!-- Step 3: Backup Codes -->
        <div v-else-if="setupStep === 'backup' && setupData" class="flex flex-col gap-3">
          <div class="bg-nc-bg-gray-light rounded-lg p-3 relative">
            <NcTooltip class="absolute top-2 right-2" :visible="recentlyCopied ? true : undefined">
              <template #title>{{ recentlyCopied ? $t('general.copied') : $t('general.copy') }}</template>
              <NcButton type="text" size="xs" @click="copyBackupCodes(setupData.backupCodes)">
                <GeneralIcon :icon="recentlyCopied ? 'check' : 'copy'" class="h-3.5 w-3.5" />
              </NcButton>
            </NcTooltip>
            <div class="grid grid-cols-2 gap-x-2 gap-y-1.5 max-w-[220px] mx-auto">
              <code v-for="code in setupData.backupCodes" :key="code" class="text-sm text-center py-0.5">
                {{ code }}
              </code>
            </div>
          </div>
          <p class="text-bodySm text-nc-content-gray-subtle mb-0">
            {{ $t('labels.backupCodesWarning') }}
          </p>

          <div class="flex flex-row gap-x-2 justify-end mt-2">
            <NcButton
              v-e="['c:account:security:copy-backup-codes']"
              type="secondary"
              size="small"
              data-testid="nc-2fa-setup-copy-backup-codes-btn"
              @click="copyBackupCodes(setupData.backupCodes)"
            >
              <div class="flex items-center gap-1.5">
                <GeneralIcon :icon="recentlyCopied ? 'check' : 'copy'" class="h-3.5 w-3.5" />
                {{ recentlyCopied ? $t('general.copied') : $t('labels.copyAll') }}
              </div>
            </NcButton>
            <NcButton type="primary" size="small" data-testid="nc-2fa-setup-confirm-saved-btn" @click="closeSetupModal">
              {{ $t('labels.iHaveSavedTheseCodes') }}
            </NcButton>
          </div>
        </div>
      </template>
    </NcModalConfirm>

    <!-- Disable Modal -->
    <NcModalConfirm
      v-model:visible="showDisableModal"
      :title="$t('labels.disableTwoFactor')"
      :show-icon="false"
      :ok-text="$t('labels.disableTwoFactor')"
      :ok-props="{ type: 'danger', loading: isLoading, disabled: !disablePassword }"
      @cancel="
        () => {
          disablePassword = ''
          disableError = ''
        }
      "
      @ok="confirmDisable"
    >
      <template #extraContent>
        <NcAlert type="warning" background>
          <template #description>
            {{ $t('labels.disableTwoFactorWarningPrefix') }}
            <span class="font-semibold">{{ $t('labels.disableTwoFactorWarningBold') }}</span
            >{{ $t('labels.disableTwoFactorWarningSuffix') }}
          </template>
        </NcAlert>

        <div class="flex flex-col gap-2">
          <div class="text-sm">{{ $t('msg.enterPassword') }}</div>
          <a-input-password
            ref="disablePasswordInput"
            v-model:value="disablePassword"
            :placeholder="$t('labels.password')"
            class="w-full nc-input-sm nc-input-shadow"
            @keyup.enter="confirmDisable"
          />
          <div v-if="disableError" class="text-red-500 text-sm">{{ disableError }}</div>
        </div>
      </template>
    </NcModalConfirm>

    <!-- Regenerate Backup Codes Modal -->
    <NcModalConfirm
      v-model:visible="showRegenerateModal"
      :title="$t('labels.regenerateBackupCodes')"
      :show-icon="false"
      :mask-closable="newBackupCodes.length === 0"
      :show-ok-btn="newBackupCodes.length === 0"
      :show-cancel-btn="newBackupCodes.length === 0"
      :ok-text="$t('labels.regenerateBackupCodes')"
      :ok-props="{ loading: isLoading, disabled: !regenerateCode }"
      @cancel="closeRegenerateModal"
      @ok="confirmRegenerate"
    >
      <template #headerAction>
        <NcButton
          v-if="newBackupCodes.length === 0"
          size="small"
          type="text"
          class="-mt-1.5 -mr-1.5"
          @click="showRegenerateModal = false"
        >
          <GeneralIcon icon="close" class="text-nc-content-gray-subtle2" />
        </NcButton>
      </template>
      <template #content>
        <span v-if="newBackupCodes.length === 0">{{ $t('labels.enterCodeToRegenerate') }}</span>
        <span v-else>{{ $t('labels.saveBackupCodes') }}</span>
      </template>
      <template #extraContent>
        <template v-if="newBackupCodes.length === 0">
          <div class="flex flex-col gap-2">
            <span class="text-sm">{{ $t('labels.verificationCode') }}</span>
            <a-input
              ref="regenerateCodeInput"
              v-model:value="regenerateCode"
              data-testid="nc-2fa-regenerate-code"
              class="w-full nc-input-sm nc-input-shadow"
              :placeholder="$t('placeholder.enterVerificationCode')"
              autocomplete="one-time-code"
              @press-enter="confirmRegenerate"
            />
            <div v-if="regenerateError" class="text-red-500 text-sm">{{ regenerateError }}</div>
          </div>
        </template>

        <template v-else>
          <div class="bg-nc-bg-gray-light rounded-lg p-3 relative">
            <NcTooltip class="absolute top-2 right-2" :visible="recentlyCopied ? true : undefined">
              <template #title>{{ recentlyCopied ? $t('general.copied') : $t('general.copy') }}</template>
              <NcButton type="text" size="xs" @click="copyBackupCodes(newBackupCodes)">
                <GeneralIcon :icon="recentlyCopied ? 'check' : 'copy'" class="h-3.5 w-3.5" />
              </NcButton>
            </NcTooltip>
            <div class="grid grid-cols-2 gap-x-2 gap-y-1.5 max-w-[220px] mx-auto">
              <code v-for="code in newBackupCodes" :key="code" class="text-sm text-center py-0.5">
                {{ code }}
              </code>
            </div>
          </div>
          <p class="text-xs text-nc-content-gray-subtle mb-0 -mt-2">
            {{ $t('labels.backupCodesWarning') }}
          </p>
          <div class="flex flex-row gap-x-2 justify-end">
            <NcButton
              v-e="['c:account:security:copy-backup-codes']"
              type="secondary"
              size="small"
              data-testid="nc-2fa-regenerate-copy-backup-codes-btn"
              @click="copyBackupCodes(newBackupCodes)"
            >
              <div class="flex items-center gap-1.5">
                <GeneralIcon :icon="recentlyCopied ? 'check' : 'copy'" class="h-3.5 w-3.5" />
                {{ recentlyCopied ? $t('general.copied') : $t('labels.copyAll') }}
              </div>
            </NcButton>
            <NcButton type="primary" size="small" data-testid="nc-2fa-regenerate-confirm-saved-btn" @click="closeRegenerateModal">
              {{ $t('labels.iHaveSavedTheseCodes') }}
            </NcButton>
          </div>
        </template>
      </template>
    </NcModalConfirm>
  </div>
</template>
